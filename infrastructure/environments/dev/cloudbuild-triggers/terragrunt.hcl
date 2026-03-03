# ==========================================
# Cloud Build Triggers — Dev Environment
# ==========================================
# Creates path-filtered triggers for all 7 pipelines.
# Auth0 configuration is centralized here and passed
# to the API Gateway trigger via substitution variables.
# ==========================================
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloudbuild-triggers"
}

inputs = {
  project_id     = "f1-visualizer-488201"
  region         = "us-central1"
  environment    = "dev"
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^dev$"

  # Auth0 configuration for dev environment
  auth0_issuer   = "https://dev-5ly43mspbpyofvc1.us.auth0.com"
  auth0_audience = "dev.api.f1visualizer.com"
}
