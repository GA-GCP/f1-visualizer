# ==========================================
# Cloud Build Triggers — Prod Environment
# ==========================================
# Creates path-filtered triggers for the five backend service
# pipelines, the frontend pipeline and the infrastructure
# pipeline. The API Gateway pipeline went with CPLX-1.
# ==========================================
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/cloudbuild-triggers"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_cloudbuild_email = "sa-f1v-cloudbuild-prod@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id     = "f1v-example-project"
  region         = "us-central1"
  environment    = "prod"
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^prod$"

  cloudbuild_service_account_email = dependency.iam.outputs.sa_cloudbuild_email
}
