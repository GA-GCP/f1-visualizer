# 1. Reserve a Global Static IP
resource "google_compute_global_address" "default" {
  name    = "${var.name_prefix}-ip"
  project = var.project_id
}

# 2. Internet NEG pointing to API Gateway
resource "google_compute_global_network_endpoint_group" "internet_neg" {
  name                  = "${var.name_prefix}-neg"
  network_endpoint_type = "INTERNET_FQDN_PORT"
  default_port          = 443
  project               = var.project_id
}

resource "google_compute_global_network_endpoint" "api_gateway_endpoint" {
  global_network_endpoint_group = google_compute_global_network_endpoint_group.internet_neg.name
  project                       = var.project_id
  fqdn                          = var.api_gateway_fqdn
  port                          = 443
}

# 3. Backend Service (CRUCIAL: Host Header Rewrite)
resource "google_compute_backend_service" "default" {
  name                  = "${var.name_prefix}-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  project               = var.project_id

  # API Gateway WILL REJECT the request if the Host header is our custom domain.
  # We MUST rewrite it to the default gateway FQDN.
  custom_request_headers = ["Host: ${var.api_gateway_fqdn}"]

  backend {
    group = google_compute_global_network_endpoint_group.internet_neg.id
  }
}

# 4. URL Map
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