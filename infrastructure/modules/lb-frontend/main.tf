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