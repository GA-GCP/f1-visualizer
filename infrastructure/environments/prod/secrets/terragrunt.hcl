include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/secrets"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-prod@f1-visualizer-488201.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-prod@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id = "f1-visualizer-488201"

  # SEC-3: granted on these two secrets rather than through a project-level
  # roles/secretmanager.secretAccessor. Ingestion runs the OpenF1 client; the
  # replay worker runs the MQTT bridge.
  openf1_accessors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
  ]
}
