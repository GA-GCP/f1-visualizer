# ==========================================
# Cloud Build Triggers — Prod Environment
# ==========================================
# Creates path-filtered triggers for all 7 pipelines.
# Auth0 configuration is centralized here and passed
# to the API Gateway trigger via substitution variables.
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

inputs = {
  project_id     = "f1-visualizer-488201"
  region         = "us-central1"
  environment    = "prod"
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^prod$"

  # Auth0 configuration for prod environment
  auth0_issuer   = "https://elysianarts.us.auth0.com"
  auth0_audience = "api.f1visualizer.com"
}
