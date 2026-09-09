include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/bigquery"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-prod@f1v-example-project.iam.gserviceaccount.com"
    sa_data_analysis_email  = "sa-f1v-data-analysis-prod@f1v-example-project.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-prod@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "prod"
  location    = "US"

  # CPLX-2: one dataset per environment. The single shared "f1_dataset" is what
  # let a UAT historical load write into the tables prod reads. The services take
  # this from F1V_BIGQUERY_DATASET, which their units now set.
  dataset_id = "f1_dataset_prod"

  # SEC-3: granted on the dataset. This list is now one environment's identities,
  # rather than all three, which is the point of splitting the dataset.
  dataset_editors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
  ]

  dataset_viewers = [
    "serviceAccount:${dependency.iam.outputs.sa_data_analysis_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
  ]
}
