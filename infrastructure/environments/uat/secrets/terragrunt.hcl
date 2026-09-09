include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/secrets"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-uat@f1v-example-project.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-uat@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id = "f1v-example-project"

  # SEC-3: granted on these two secrets rather than through a project-level
  # roles/secretmanager.secretAccessor. Ingestion runs the OpenF1 client; the
  # replay worker runs the MQTT bridge.
  openf1_accessors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
  ]
}
