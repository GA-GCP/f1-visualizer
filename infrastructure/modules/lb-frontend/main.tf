# 1. Reserve a Global Static IP
resource "google_compute_global_address" "default" {
  name    = "${var.name_prefix}-ip"
  project = var.project_id
}

# 2. Serverless NEG pointing to the Cloud Run service
resource "google_compute_region_network_endpoint_group" "serverless_neg" {
  name                  = "${var.name_prefix}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id
  cloud_run {
    service = var.cloud_run_service_name
  }
}

# 3. Backend Service
resource "google_compute_backend_service" "default" {
  name                  = "${var.name_prefix}-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  project               = var.project_id

  # Negotiate brotli or gzip per request at the edge. Neither Cloud Run nor the
  # LB compresses by default, so without this the browser downloads the full
  # uncompressed bundle (~1.15 MB rather than ~358 kB gzip / ~300 kB brotli).
  # nginx also gzips at the origin, which covers the raw run.app URL.
  compression_mode = "AUTOMATIC"

  # PERF-2: every asset request travelled to a Cloud Run instance, so cold starts
  # and instance count scaled with page views rather than with deploys, and a
  # user far from the origin region paid the full round trip for a ~300 kB
  # bundle. nginx already emits exactly the right headers — hashed assets get
  # `max-age=315360000`, index.html gets `no-cache` — so USE_ORIGIN_HEADERS needs
  # no change at the origin and cannot cache the SPA shell by accident.
  enable_cdn = true

  cdn_policy {
    cache_mode = "USE_ORIGIN_HEADERS"

    # Keeps a 404 for a stale asset path from becoming a request per visitor.
    negative_caching = true

    # A day of serving the last known-good asset if the origin is unreachable.
    # Safe precisely because the paths are content-hashed.
    serve_while_stale = 86400

    cache_key_policy {
      # Hashed filenames already carry the version; a query string on an asset
      # URL would otherwise fragment the cache for no benefit.
      include_query_string = false
    }
  }

  # OPS-2: logging is off unless log_config sets it, so the only frontend signal
  # was nginx's own access log inside the container. Sampled at 10%: this is
  # asset traffic, and the shape matters more than the individual request.
  log_config {
    enable      = true
    sample_rate = 0.1
  }

  security_policy = google_compute_security_policy.frontend.id

  backend {
    group = google_compute_region_network_endpoint_group.serverless_neg.id
  }
}

# 4. URL Map (Routes traffic to the backend)
resource "google_compute_url_map" "default" {
  name            = "${var.name_prefix}-url-map"
  default_service = google_compute_backend_service.default.id
  project         = var.project_id
}

# 5. Google-Managed SSL Certificate
resource "google_compute_managed_ssl_certificate" "default" {
  name    = "${var.name_prefix}-cert"
  project = var.project_id

  managed {
    domains = [var.domain]
  }
}

# 6. Target HTTPS Proxy
resource "google_compute_target_https_proxy" "default" {
  name    = "${var.name_prefix}-https-proxy"
  url_map = google_compute_url_map.default.id
  project = var.project_id

  # SEC-5: exactly one of these is set. The classic certificate stays until the
  # Certificate Manager one is ACTIVE; see the cutover note below.
  ssl_certificates = var.use_certificate_manager ? null : [google_compute_managed_ssl_certificate.default.id]
  certificate_map  = var.use_certificate_manager ? google_certificate_manager_certificate_map.default[0].id : null

  # SEC-5: TLS 1.2 and the MODERN cipher profile, instead of the default policy's
  # TLS 1.0 and COMPATIBLE.
  ssl_policy = google_compute_ssl_policy.default.id
}

# 7. Global Forwarding Rule
resource "google_compute_global_forwarding_rule" "default" {
  name                  = "${var.name_prefix}-https-rule"
  target                = google_compute_target_https_proxy.default.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.default.address
  project               = var.project_id
}

# ==============================================================================
# SEC-5: TLS and edge posture
# ==============================================================================
# The target HTTPS proxy used the default SSL policy, which permits TLS 1.0 and
# the COMPATIBLE cipher profile — a scanner reports that as weak TLS on a public
# endpoint. Only a port-443 forwarding rule existed, so `http://` refused the
# connection rather than upgrading; nginx sets HSTS, which only helps after a
# first successful HTTPS visit. And both addresses were IPv4 only, so an
# IPv6-only client could not connect at all.

resource "google_compute_ssl_policy" "default" {
  name            = "${var.name_prefix}-ssl-policy"
  project         = var.project_id
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# A URL map that only redirects. It has no backend, so it costs nothing to serve
# and cannot route anywhere by accident.
resource "google_compute_url_map" "https_redirect" {
  name    = "${var.name_prefix}-http-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${var.name_prefix}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.https_redirect.id
}

# IPv6. Needs an AAAA record alongside the A record; until that exists the
# address is reserved and unreachable, which harms nothing.
resource "google_compute_global_address" "ipv6" {
  name       = "${var.name_prefix}-ipv6"
  project    = var.project_id
  ip_version = "IPV6"
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.name_prefix}-http-rule"
  project               = var.project_id
  target                = google_compute_target_http_proxy.redirect.id
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.default.address
}

resource "google_compute_global_forwarding_rule" "https_ipv6" {
  name                  = "${var.name_prefix}-https-rule-v6"
  project               = var.project_id
  target                = google_compute_target_https_proxy.default.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.ipv6.address
}

resource "google_compute_global_forwarding_rule" "http_ipv6" {
  name                  = "${var.name_prefix}-http-rule-v6"
  project               = var.project_id
  target                = google_compute_target_http_proxy.redirect.id
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.ipv6.address
}

# ==============================================================================
# SEC-4: Cloud Armor
# ==============================================================================
# Lighter than the API policy on purpose. This backend serves a static bundle
# behind a CDN (PERF-2), so most requests never reach it and there is no input to
# attack — the ceiling is here to bound the cost of someone deliberately missing
# the cache, not to inspect payloads.
resource "google_compute_security_policy" "frontend" {
  name        = "${var.name_prefix}-armor"
  project     = var.project_id
  description = "Rate limiting for the F1V frontend edge"

  rule {
    action      = "throttle"
    priority    = 1000
    description = "Throttle requests per client IP"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      # A first page load is one document plus a handful of hashed assets, all
      # then cached in the browser for a decade.
      rate_limit_threshold {
        count        = 600
        interval_sec = 60
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = var.enable_adaptive_protection
    }
  }
}

# ==============================================================================
# OPS-3: DNS records
# ==============================================================================
# The A records the managed certificate depends on were never in the repository,
# which is why the certificates' bootstrap failure — stuck in PROVISIONING until
# the domain resolves to this address — had no codified answer. The zone lives in
# infrastructure/platform; the records live here, with the addresses they point
# at, so an environment's apply stays self-contained.
resource "google_dns_record_set" "a" {
  count = var.dns_zone_name == "" ? 0 : 1

  project      = var.project_id
  managed_zone = var.dns_zone_name
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.default.address]
}

resource "google_dns_record_set" "aaaa" {
  count = var.dns_zone_name == "" ? 0 : 1

  project      = var.project_id
  managed_zone = var.dns_zone_name
  name         = "${var.domain}."
  type         = "AAAA"
  ttl          = 300
  rrdatas      = [google_compute_global_address.ipv6.address]
}

# ==============================================================================
# SEC-5: Certificate Manager
# ==============================================================================
# google_compute_managed_ssl_certificate is the classic type: one domain per
# certificate, no way to add `www` without a second certificate and a second
# proxy slot, and a renewal path with no visibility. Certificate Manager
# validates through DNS instead of through the load balancer answering on the
# domain, so a certificate can be issued and confirmed ACTIVE *before* anything
# routes through it.
#
# Both paths exist on purpose. The resources below are created either way, so the
# certificate can validate while the classic one is still serving; flipping
# `use_certificate_manager` is the cutover, and it is one line per environment.
# Pointing a live proxy at a certificate map before the certificate is ACTIVE
# takes HTTPS down, which is why this is not a single-step change.
resource "google_certificate_manager_dns_authorization" "default" {
  count = var.dns_zone_name == "" ? 0 : 1

  project = var.project_id
  name    = "${var.name_prefix}-dnsauth"
  domain  = var.domain
}

# The CNAME the authorization needs. In the zone, so validation completes without
# anyone copying a record out of the console.
resource "google_dns_record_set" "dns_auth" {
  count = var.dns_zone_name == "" ? 0 : 1

  project      = var.project_id
  managed_zone = var.dns_zone_name
  name         = google_certificate_manager_dns_authorization.default[0].dns_resource_record[0].name
  type         = google_certificate_manager_dns_authorization.default[0].dns_resource_record[0].type
  ttl          = 300
  rrdatas      = [google_certificate_manager_dns_authorization.default[0].dns_resource_record[0].data]
}

resource "google_certificate_manager_certificate" "default" {
  count = var.dns_zone_name == "" ? 0 : 1

  project = var.project_id
  name    = "${var.name_prefix}-cert-managed"

  managed {
    domains            = [var.domain]
    dns_authorizations = [google_certificate_manager_dns_authorization.default[0].id]
  }
}

resource "google_certificate_manager_certificate_map" "default" {
  count = var.dns_zone_name == "" ? 0 : 1

  project = var.project_id
  name    = "${var.name_prefix}-cert-map"
}

resource "google_certificate_manager_certificate_map_entry" "default" {
  count = var.dns_zone_name == "" ? 0 : 1

  project      = var.project_id
  name         = "${var.name_prefix}-cert-entry"
  map          = google_certificate_manager_certificate_map.default[0].name
  certificates = [google_certificate_manager_certificate.default[0].id]
  matcher      = "PRIMARY"
}
