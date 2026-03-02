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

    # VPC Access (Critical for Redis)
    dynamic "vpc_access" {
      for_each = var.vpc_connector_id != null ? [1] : []
      content {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }

    service_account = var.service_account_email

    containers {
      image = var.image_url

      # Resources
      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      # Environment Variables
      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

# Optional: Public Access Binding (Used for Frontend)
resource "google_cloud_run_service_iam_member" "public_access" {
  count    = var.is_public ? 1 : 0
  service  = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}