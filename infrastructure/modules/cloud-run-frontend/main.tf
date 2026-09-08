resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = var.deletion_protection

  template {
    # Scaling settings
    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = var.image_url

      # Optimized for Vite/React static serving — lightweight defaults
      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        cpu_idle          = true # Throttle CPU when idle (cost savings for static serving)
        startup_cpu_boost = true # Faster cold starts for the Vite/Nginx container
      }

      # Without an explicit probe Cloud Run falls back to a TCP check, which
      # only proves nginx bound the port — a container serving an empty or
      # half-copied dist/ passes it. /healthz is an exact-match location in
      # nginx.conf that answers before the SPA fallback, so a 200 from it means
      # the config loaded, rather than meaning index.html happens to exist.
      #
      # No `port` here: it defaults to the container port (8080), which is what
      # nginx.conf listens on.
      startup_probe {
        http_get {
          path = "/healthz"
        }
        # Static nginx is ready in well under a second; the generous failure
        # budget is for a cold start on a throttled CPU, not for slow startup.
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 6
      }

      # Restarts an instance whose nginx is alive as a process but no longer
      # serving. 30 s keeps probe traffic negligible; nginx.conf turns off
      # access logging for this path so it does not drown the request log.
      liveness_probe {
        http_get {
          path = "/healthz"
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }
}

# Public Access Binding — frontend is always internet-facing
resource "google_cloud_run_service_iam_member" "public_access" {
  count    = var.is_public ? 1 : 0
  service  = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}
