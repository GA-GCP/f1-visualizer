# Reserve a Global Static IP
resource "google_compute_global_address" "default" {
  name    = "${var.name_prefix}-ip"
  project = var.project_id
}

# Internet NEG pointing to API Gateway
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


# --- NEW: Serverless NEG for WebSocket Bypass ---
resource "google_compute_region_network_endpoint_group" "telemetry_neg" {
  name                  = "${var.name_prefix}-telemetry-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "us-central1" # Hardcoded for simplicity, or add as a var
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

  backend {
    group = google_compute_region_network_endpoint_group.telemetry_neg.id
  }
}

# Backend Service (CRUCIAL: Host Header Rewrite)
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

# URL Map
resource "google_compute_url_map" "default" {
  name            = "${var.name_prefix}-url-map"
  default_service = google_compute_backend_service.default.id # Default routes to API Gateway
  project         = var.project_id

  host_rule {
    hosts        = ["*"]
    path_matcher = "api-paths"
  }

  path_matcher {
    name            = "api-paths"
    default_service = google_compute_backend_service.default.id

    # Route WebSockets directly to the Telemetry Cloud Run service
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
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
  project          = var.project_id
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