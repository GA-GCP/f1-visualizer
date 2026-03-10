# ==========================================
# Cloud Build Triggers — UAT Environment
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
  region         = "us-east1"
  environment    = "uat"
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^uat$"

  # Auth0 configuration for uat environment
  auth0_issuer   = "https://elysianarts-uat.us.auth0.com"
  auth0_audience = "uat.api.f1visualizer.com"
}
