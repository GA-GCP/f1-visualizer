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
