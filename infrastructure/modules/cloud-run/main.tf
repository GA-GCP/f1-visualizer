resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  ingress  = var.ingress

  deletion_protection = var.deletion_protection

  template {
    timeout               = var.timeout
    execution_environment = var.execution_environment

    # Scaling settings
    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    # VPC Access (Critical for Redis)
    #
    # PERF-1: this was `connector = <serverless VPC access connector>`. Each
    # environment ran one with 2 to 3 always-on e2-micro instances — a fixed
    # monthly floor and a shared bandwidth ceiling sitting on the hottest path in
    # the system, the Redis pub/sub fan-out to the WebSocket broadcaster. Direct
    # VPC egress puts the instance on the subnet itself: one hop fewer, no
    # standing cost, and the throughput is the instance's own.
    dynamic "vpc_access" {
      for_each = var.vpc_network != null ? [1] : []
      content {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = var.vpc_network
          subnetwork = var.vpc_subnetwork
        }
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
        container_port = var.container_port
      }

      # R10: without probes Cloud Run only learns a container is alive when the
      # port opens, so a service whose Redis or BigQuery client is broken keeps
      # receiving traffic. Actuator's readiness and liveness groups are permitted
      # without authentication precisely for this.
      #
      # CPLX-4: the frontend used to have its own module with its own copy of
      # these, pointing at nginx's /healthz with different timings. They are
      # inputs now, so there is one place to change how a probe works.
      startup_probe {
        initial_delay_seconds = var.startup_probe.initial_delay_seconds
        period_seconds        = var.startup_probe.period_seconds
        timeout_seconds       = var.startup_probe.timeout_seconds
        failure_threshold     = var.startup_probe.failure_threshold

        http_get {
          path = var.startup_probe.path
          port = var.container_port
        }
      }

      liveness_probe {
        initial_delay_seconds = var.liveness_probe.initial_delay_seconds
        period_seconds        = var.liveness_probe.period_seconds
        timeout_seconds       = var.liveness_probe.timeout_seconds
        failure_threshold     = var.liveness_probe.failure_threshold

        http_get {
          path = var.liveness_probe.path
          port = var.container_port
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

  # REL-1: the pipeline owns which image is live and how traffic is split; this
  # module owns everything else about the service.
  #
  # Without this, an infrastructure apply reads `:<sha>` from the refreshed state,
  # sees `:latest-<env>` in configuration, and creates a revision from whatever
  # was built last — then the v2 API's absent `traffic` block sends 100% to it.
  # A routine prod infrastructure change was therefore also an unreviewed
  # application deploy of an image nobody chose.
  #
  # `client` and `client_version` are optional, non-computed attributes that
  # gcloud stamps on every deploy, so they would otherwise show a
  # `"gcloud" -> null` diff on every plan.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      traffic,
      client,
      client_version,
    ]
  }
}

# CPLX-4: this was two variables for one concept — `is_public` (a bool that
# produced an `allUsers` binding) and `invoker_service_accounts` (a list). Safe
# use depended on a caller remembering which to set, and the v1 IAM resource was
# being used against a v2 service.
#
# S3: every service used to carry allUsers, so the *.run.app URL answered
# straight from the internet and the load balancer's edge CORS handling, its
# Cloud Armor policy and its routing could all be walked around. The services
# reached through a serverless NEG still need it — a NEG cannot present an ID
# token — so their exposure is closed off with `ingress` instead, which is why
# the default below is the load-balancer-only value.
resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = toset(var.invokers)

  name     = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  role     = "roles/run.invoker"
  member   = each.value
}
