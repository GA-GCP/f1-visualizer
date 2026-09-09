# ==========================================
# Cloud Build Triggers — UAT Environment
# ==========================================
# Creates path-filtered triggers for the five backend service
# pipelines, the frontend pipeline and the infrastructure
# pipeline. The API Gateway pipeline went with CPLX-1.
# ==========================================
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloudbuild-triggers"
}

inputs = {
  project_id     = "f1v-example-project"
  region         = "us-east1"
  environment    = "uat"
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^uat$"
}
