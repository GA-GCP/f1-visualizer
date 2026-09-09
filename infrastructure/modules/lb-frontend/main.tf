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
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
  project          = var.project_id
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