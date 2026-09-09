# ==============================================================================
# redis — the live telemetry cache and replay state store
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/redis"
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    network_id = "projects/${local.env.project_id}/global/networks/${local.env.network_name}-MOCK"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-${local.env.environment}@f1v-example-project.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-${local.env.environment}@f1v-example-project.iam.gserviceaccount.com"
    sa_telemetry_email      = "sa-f1v-telemetry-${local.env.environment}@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  environment = local.env.environment
  region      = local.env.region
  network_id  = dependency.networking.outputs.network_id

  # REL-12: declared, rather than decided by comparing the environment name to
  # the string "prod" inside the module.
  tier           = local.env.is_production ? "STANDARD_HA" : "BASIC"
  memory_size_gb = 1

  # SEC-3: the three services that hold a Redis connection, granted on this
  # instance's AUTH and CA secrets rather than through a project-level
  # roles/secretmanager.secretAccessor.
  auth_secret_accessors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
    "serviceAccount:${dependency.iam.outputs.sa_telemetry_email}",
  ]
}
