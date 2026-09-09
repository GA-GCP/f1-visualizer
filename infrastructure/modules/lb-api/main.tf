# ==============================================================================
# API load balancer
# ==============================================================================
# CPLX-1 / PERF-3: this used to front an internet NEG pointing at API Gateway,
# which then called the REST services over their public *.run.app URLs. Two extra
# TLS terminations and a public hop in front of services that already validate the
# same Auth0 JWT. The gateway's routing was seventeen operations of openapi.yaml
# maintained by a pipeline that rewrote the spec with sed; the same routing is
# four path prefixes here, because the load balancer matches on prefix.
#
# What went with it: the beta-only provider, the placeholder spec applied by IaC
# and then ignored with `ignore_changes`, the Host-rewrite header, the gateway
# service account and its per-service invoker bindings, and the reason the REST
# services had to keep INGRESS_TRAFFIC_ALL.
#
# What we gave up: unlisted paths are no longer refused at the edge — they now
# reach a service, where Spring's `anyRequest().authenticated()` answers 401 —
# and per-route gateway metrics are replaced by load-balancer request logs
# (OPS-2). Rate limiting moves to Cloud Armor (SEC-4).

locals {
  # The prefix each REST service owns. Both forms are listed because a URL map
  # path rule matches the literal path or the prefix, not both from one entry.
  rest_backends = {
    users = {
      service_name = var.user_service_name
      paths        = ["/api/v1/users", "/api/v1/users/*"]
    }
    analysis = {
      service_name = var.analysis_service_name
      paths        = ["/api/v1/analysis", "/api/v1/analysis/*"]
    }
    ingestion = {
      service_name = var.ingestion_service_name
      paths        = ["/api/v1/ingestion", "/api/v1/ingestion/*"]
    }
  }
}

# Reserve a Global Static IP
resource "google_compute_global_address" "default" {
  name    = "${var.name_prefix}-ip"
  project = var.project_id
}

# ==============================================================================
# REST backends — one serverless NEG and one backend service per service
# ==============================================================================
resource "google_compute_region_network_endpoint_group" "rest_neg" {
  for_each = local.rest_backends

  name                  = "${var.name_prefix}-${each.key}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = each.value.service_name
  }
}

resource "google_compute_backend_service" "rest" {
  for_each = local.rest_backends

  name                  = "${var.name_prefix}-${each.key}-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  project               = var.project_id

  # REL-10: the gateway declared `deadline: 60.0` on every operation while the
  # backend service in front of it left `timeout_sec` at its default of 30, so a
  # slow BigQuery query returned a 504 from the edge while the gateway was still
  # waiting. Stated here at the value the application was written against. For a
  # serverless NEG the Cloud Run request timeout is the binding constraint, so
  # this is the ceiling rather than the whole story.
  timeout_sec = 60

  # PERF-7: only the analysis service. /analysis/drivers, /sessions, /years and
  # /sessions/year/{year} return the same bytes for every caller, and
  # ReferenceDataController already marks them `Cache-Control: public,
  # max-age=3600` (P5) — the origin half of this finding was done. USE_ORIGIN_HEADERS
  # means the CDN caches exactly what the origin says is cacheable, so
  # /session/{key}/laps and /drivers/{id}/stats, which carry no public directive,
  # are not cached.
  #
  # Trade-off, stated because it is a real change and not only a speed-up: a
  # response the origin marks `public` is served from the edge on the cache key
  # alone, and the default key does not include Authorization. Those six
  # reference endpoints therefore answer without a token once warm. The data is
  # public F1 reference data from OpenF1 and the application already declares it
  # public — but if that is not wanted, the fix is `cache_key_policy {
  # include_http_headers = ["Authorization"] }` here, which keeps the token in
  # the key at the cost of a per-user cache.
  dynamic "cdn_policy" {
    for_each = each.key == "analysis" ? [1] : []
    content {
      cache_mode        = "USE_ORIGIN_HEADERS"
      negative_caching  = true
      serve_while_stale = 0
    }
  }
  enable_cdn = each.key == "analysis"

  # OPS-2: 4xx and 5xx rates, latency and client IPs at the edge could not be
  # queried at all. Full sampling on the REST paths — the volume is low and these
  # are the requests that matter. Cloud Armor decisions (SEC-4) land here too.
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  security_policy = google_compute_security_policy.api.id

  backend {
    group = google_compute_region_network_endpoint_group.rest_neg[each.key].id
  }
}

# ==============================================================================
# Telemetry backend — the WebSocket route, which has always bypassed the gateway
# ==============================================================================
resource "google_compute_region_network_endpoint_group" "telemetry_neg" {
  name                  = "${var.name_prefix}-telemetry-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = var.telemetry_service_name
  }
}

resource "google_compute_backend_service" "telemetry_backend" {
  name                  = "${var.name_prefix}-telemetry-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  project               = var.project_id

  # OPS-2: the WebSocket backend had no signal at the edge at all.
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  security_policy = google_compute_security_policy.api.id

  backend {
    group = google_compute_region_network_endpoint_group.telemetry_neg.id
  }
}

# ==============================================================================
# URL map
# ==============================================================================
# Every REST rule carries its own cors_policy. That is not decoration: handling
# OPTIONS at the edge with a 204 is what removed a documented cascade — a non-2xx
# preflight (from a cold start or a rate limit) makes the browser block the real
# request, whose retries then compound the cause. cors_policy does not inherit
# into a path_rule from default_route_action, so it is stated per rule.
resource "google_compute_url_map" "default" {
  name = "${var.name_prefix}-url-map"

  # An unmatched path reaches the user service, which is the smallest of the
  # three, and answers 401 or 404. The gateway used to refuse these at the edge;
  # Cloud Armor's throttle rule (SEC-4) is what keeps that from being an
  # amplification route.
  default_service = google_compute_backend_service.rest["users"].id
  project         = var.project_id

  host_rule {
    hosts        = ["*"]
    path_matcher = "api-paths"
  }

  path_matcher {
    name = "api-paths"

    default_route_action {
      cors_policy {
        allow_origins     = [var.frontend_origin]
        allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        allow_headers     = ["Authorization", "Cache-Control", "Content-Type"]
        allow_credentials = true
        max_age           = 3600
      }

      weighted_backend_services {
        backend_service = google_compute_backend_service.rest["users"].id
        weight          = 100
      }
    }

    dynamic "path_rule" {
      for_each = local.rest_backends

      content {
        paths = path_rule.value.paths

        route_action {
          cors_policy {
            # Required inside a path_rule's route_action, unlike in
            # default_route_action where the provider defaults it.
            disabled          = false
            allow_origins     = [var.frontend_origin]
            allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
            allow_headers     = ["Authorization", "Cache-Control", "Content-Type"]
            allow_credentials = true
            max_age           = 3600
          }

          weighted_backend_services {
            backend_service = google_compute_backend_service.rest[path_rule.key].id
            weight          = 100
          }
        }
      }
    }

    # WebSockets go straight to the telemetry service. No cors_policy: a browser
    # does not apply CORS to a WebSocket handshake, and the SockJS XHR fallback
    # that would have needed it is gone.
    path_rule {
      paths   = ["/ws", "/ws/*"]
      service = google_compute_backend_service.telemetry_backend.id
    }
  }
}

# Google-Managed SSL Certificate
resource "google_compute_managed_ssl_certificate" "default" {
  name    = "${var.name_prefix}-cert"
  project = var.project_id

  managed {
    domains = [var.domain]
  }
}

# Target HTTPS Proxy
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

# Global Forwarding Rule
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
# There was no security policy on either load balancer and no backend service set
# `security_policy`, so the only thing standing between a public API and an
# arbitrary request rate was Cloud Run autoscaling — which converts abuse into a
# bill. The frontend's client-side retry logic exists specifically to survive 429
# cascades, which is the symptom of having no rate limiting at the edge.
#
# This is also what keeps CPLX-1's trade-off honest: with the gateway gone,
# unlisted paths reach a service instead of being refused at the edge, and this
# is the throttle that bounds what that costs.
resource "google_compute_security_policy" "api" {
  name        = "${var.name_prefix}-armor"
  project     = var.project_id
  description = "Rate limiting and preconfigured WAF rules for the F1V API edge"

  # A WebSocket handshake pins an instance for up to an hour, so the ceiling is
  # much lower than for REST. A real user opens one.
  rule {
    action      = "throttle"
    priority    = 1000
    description = "Throttle WebSocket handshakes per client IP"

    match {
      expr {
        expression = "request.path.startsWith('/ws')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = 20
        interval_sec = 60
      }
    }
  }

  # 300 a minute is far above what the SPA generates — the splash screen
  # prefetch is a handful of calls — and far below what makes autoscaling
  # expensive.
  rule {
    action      = "throttle"
    priority    = 1100
    description = "Throttle REST requests per client IP"

    match {
      expr {
        expression = "request.path.startsWith('/api/')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = 300
        interval_sec = 60
      }
    }
  }

  # Sensitivity 1 is the lowest-false-positive tier of each preconfigured rule
  # set. The services take JSON bodies and path variables, not SQL or markup, so
  # a match here is a probe rather than a legitimate request.
  dynamic "rule" {
    for_each = {
      2000 = "sqli-v33-stable"
      2100 = "xss-v33-stable"
      2200 = "lfi-v33-stable"
      2300 = "rce-v33-stable"
    }

    content {
      action      = "deny(403)"
      priority    = rule.key
      description = "Preconfigured WAF: ${rule.value} at sensitivity 1"

      match {
        expr {
          expression = "evaluatePreconfiguredWaf('${rule.value}', {'sensitivity': 1})"
        }
      }
    }
  }

  # Required: the lowest-priority rule is the default action.
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

  # Adaptive Protection is a Cloud Armor Enterprise feature and is billed
  # separately, so it is off by default rather than switched on in a commit that
  # would quietly add a subscription.
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
