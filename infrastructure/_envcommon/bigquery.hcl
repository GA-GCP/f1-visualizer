# ==============================================================================
# bigquery — one dataset per environment (CPLX-2)
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/bigquery"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-${local.env.environment}@${local.env.project_id}.iam.gserviceaccount.com"
    sa_data_analysis_email  = "sa-f1v-data-analysis-${local.env.environment}@${local.env.project_id}.iam.gserviceaccount.com"
    sa_replay_worker_email  = "sa-f1v-replay-worker-${local.env.environment}@${local.env.project_id}.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  environment = local.env.environment
  location    = "US"

  # CPLX-2: one shared "f1_dataset" declared in environments/dev is what let a
  # UAT historical load write into the tables prod reads.
  dataset_id = local.env.bigquery_dataset_id

  # SEC-3: on the dataset, and only this environment's identities.
  dataset_editors = [
    "serviceAccount:${dependency.iam.outputs.sa_data_ingestion_email}",
  ]

  dataset_viewers = [
    "serviceAccount:${dependency.iam.outputs.sa_data_analysis_email}",
    "serviceAccount:${dependency.iam.outputs.sa_replay_worker_email}",
  ]
}
