resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  ingress  = var.ingress

  deletion_protection = var.deletion_protection

  template {
    timeout = var.timeout

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

    max_instance_request_concurrency = var.container_concurrency

    containers {
      image = var.image_url

      # Resources
      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        startup_cpu_boost = true # JVM warm-up benefits for Spring Boot services

        # false = CPU is always allocated, not just while a request is in flight.
        # Required by any service that does work off the request thread: the
        # replay tick loop, MQTT callbacks and the Redis pub/sub subscriber all
        # run throttled to near-zero otherwise (R1).
        cpu_idle = var.cpu_idle
      }

      # Environment Variables
      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      ports {
        container_port = 8080
      }

      # R10: without probes Cloud Run only learns a container is alive when the
      # port opens, so a service whose Redis or BigQuery client is broken keeps
      # receiving traffic. Actuator's readiness and liveness groups are permitted
      # without authentication precisely for this.
      startup_probe {
        initial_delay_seconds = 10
        period_seconds        = 5
        timeout_seconds       = 5
        # 30 x 5s = 150s, which is generous for a JVM cold start with CPU boost.
        failure_threshold = 30
        http_get {
          path = "/actuator/health/readiness"
          port = 8080
        }
      }

      liveness_probe {
        initial_delay_seconds = 30
        period_seconds        = 30
        timeout_seconds       = 5
        failure_threshold     = 3
        http_get {
          path = "/actuator/health/liveness"
          port = 8080
        }
      }

      # Secret-backed environment variables (env var name => Secret Manager
      # secret id). Used for the Redis AUTH string so it never appears in a
      # Terragrunt input, a Cloud Run revision description or a log (S2).
      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }
    }
  }
}

# Optional: Public Access Binding
#
# S3: every service used to carry this, so the *.run.app URL answered straight
# from the internet and the gateway's routing, the LB's edge CORS handling and any
# future Cloud Armor policy could all be walked around. It is now kept only where
# the caller genuinely is the public — the telemetry WebSocket, which is fronted by
# the load balancer's serverless NEG and cannot present an ID token.
resource "google_cloud_run_service_iam_member" "public_access" {
  count    = var.is_public ? 1 : 0
  service  = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Named callers. The API Gateway's service account holds this on each REST
# service and presents an ID token minted for the service's own URL, which is
# what `disable_auth: false` plus `jwt_audience` in openapi.yaml produce (S3).
resource "google_cloud_run_service_iam_member" "invokers" {
  for_each = toset(var.invoker_service_accounts)
  service  = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value}"
}
