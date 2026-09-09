include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_frontend_email = "sa-f1v-frontend-dev@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-webapp-dev"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/frontend:latest-dev"

  # SEC-2: the isolated frontend identity, which holds no IAM bindings anywhere.
  # Without it Cloud Run falls back to the default compute service account.
  service_account_email = dependency.iam.outputs.sa_frontend_email

  # The SPA is the public entry point. SEC-10 discusses narrowing this; the
  # reasoning for leaving it open is in the module.
  invokers = ["allUsers"]
  ingress  = "INGRESS_TRAFFIC_ALL"

  # CPLX-4: nginx, not a JVM. Ready in well under a second; the generous failure
  # budget is for a cold start on a throttled CPU rather than for slow startup.
  # /healthz is an exact-match location that answers before the SPA fallback, so
  # a 200 means the config loaded rather than meaning index.html exists.
  startup_probe = {
    path                  = "/healthz"
    initial_delay_seconds = 0
    period_seconds        = 5
    timeout_seconds       = 3
    failure_threshold     = 6
  }

  liveness_probe = {
    path              = "/healthz"
    period_seconds    = 30
    timeout_seconds   = 3
    failure_threshold = 3
  }

  # PERF-8: static serving, with a CDN in front of it (PERF-2).
  cpu      = "1000m"
  memory   = "256Mi"
  cpu_idle = true

  max_instance_count = 3
}
