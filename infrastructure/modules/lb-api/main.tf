locals {
  # CORS response headers for the telemetry backend (WebSocket route).
  # REST API routes use the URL Map cors_policy instead (see below).
  ws_cors_response_headers = [
    "Access-Control-Allow-Origin: ${var.frontend_origin}",
    "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers: Authorization, Cache-Control, Content-Type",
    "Access-Control-Allow-Credentials: true",
    "Access-Control-Max-Age: 3600",
  ]
}

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

  custom_response_headers = local.ws_cors_response_headers

  backend {
    group = google_compute_region_network_endpoint_group.telemetry_neg.id
  }
}

# Backend Service (CRUCIAL: Host Header Rewrite)
# NOTE: CORS response headers for this backend are handled by the URL Map's
# cors_policy (see below), NOT by custom_response_headers here.  This avoids
# duplicate Access-Control-Allow-* headers and — critically — lets the LB
# respond to OPTIONS preflight requests directly (HTTP 204) without ever
# forwarding them to the API Gateway, which eliminates the cascade:
#   cold-start / rate-limit → non-2xx OPTIONS → CORS block → retry storm.
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
# The cors_policy on default_route_action makes the LB handle OPTIONS preflight
# requests at the edge, responding with 204 + CORS headers WITHOUT forwarding
# to the API Gateway.  This is essential because preflight failures cascade:
# a non-2xx OPTIONS (from cold-start, rate-limit, or gateway misconfiguration)
# causes the browser to block the real request, triggering retries that compound
# the problem.  Handling CORS at the LB eliminates this entire failure mode.
resource "google_compute_url_map" "default" {
  name            = "${var.name_prefix}-url-map"
  default_service = google_compute_backend_service.default.id
  project         = var.project_id

  host_rule {
    hosts        = ["*"]
    path_matcher = "api-paths"
  }

  path_matcher {
    name = "api-paths"

    # REST API routes → API Gateway, with LB-level CORS handling
    default_route_action {
      cors_policy {
        allow_origins     = [var.frontend_origin]
        allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        allow_headers     = ["Authorization", "Cache-Control", "Content-Type"]
        allow_credentials = true
        max_age           = 3600
      }

      weighted_backend_services {
        backend_service = google_compute_backend_service.default.id
        weight          = 100
      }
    }

    # Route WebSockets directly to the Telemetry Cloud Run service.
    # CORS for this path is handled by custom_response_headers on the
    # telemetry backend service (cors_policy doesn't apply to path_rules).
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