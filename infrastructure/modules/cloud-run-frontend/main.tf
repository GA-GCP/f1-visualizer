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
