# 1. Inherit the root configuration (GCS State Bucket & Tofu Override)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

# 2. Point to the reusable OpenTofu module (We'll start with networking)
terraform {
  source = "../../../modules/networking"
}

# 3. Pass in the PROD-specific variables
inputs = {
  environment  = "prod"
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  network_name   = "f1v-vpc-prod"
  connector_cidr = "10.8.0.32/28"
}
