# ==============================================================================
# f1v-webapp — the React SPA, served by nginx
# ==============================================================================
# CPLX-3: the shared definition. Everything here was repeated in three
# near-identical unit files; what differs per environment comes from env.hcl, and
# a unit adds only a genuine override.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_frontend_email = "sa-f1v-frontend-${local.env.environment}@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region       = local.env.region
  service_name = "f1v-webapp-${local.env.environment}"
  image_url    = "${local.env.registry_host}/${local.env.repository}/frontend:${local.env.image_tag}"

  # SEC-2: the isolated frontend identity, which holds no IAM bindings anywhere.
  # Without it Cloud Run falls back to the default compute service account.
  service_account_email = dependency.iam.outputs.sa_frontend_email

  # The SPA is the public entry point. SEC-10 discusses narrowing this; the
  # reasoning for leaving it open is in modules/cloud-run.
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
