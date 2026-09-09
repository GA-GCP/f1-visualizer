include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/lb-frontend"
}

inputs = {
  project_id             = "f1-visualizer-488201"
  region                 = "us-central1"
  name_prefix            = "f1v-frontend-prod"
  domain                 = "f1visualizer.com"
  cloud_run_service_name = "f1v-webapp-prod"
}
