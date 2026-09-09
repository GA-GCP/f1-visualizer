include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/redis"
}

dependency "networking" {
  config_path = "../networking"

  # -----------------------------------------------------------
  # FIX: Mock Outputs for "run-all plan"
  # This allows the plan to succeed even if the network hasn't been created yet.
  # -----------------------------------------------------------
  mock_outputs = {
    network_id = "projects/f1v-example-project/global/networks/f1v-vpc-dev-MOCK"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-dev@f1v-example-project.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-dev@f1v-example-project.iam.gserviceaccount.com"
    sa_telemetry_email      = "sa-f1v-telemetry-dev@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "dev"
  region      = "us-central1"

  # Single node, no failover: a dev cache that restarts is a re-load, not an
  # incident.
  tier           = "BASIC"
  memory_size_gb = 1

  # The mock output above allows this reference to resolve during the plan phase
  network_id = dependency.networking.outputs.network_id

  # SEC-3: the three services that hold a Redis connection. Granted on this
  # secret rather than through a project-level roles/secretmanager.secretAccessor,
  # which let every environment read every other environment's AUTH string.
  auth_secret_accessors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
    "serviceAccount:${dependency.iam.outputs.sa_telemetry_email}",
  ]
}
