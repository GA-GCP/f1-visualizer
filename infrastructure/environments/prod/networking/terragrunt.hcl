# 1. Inherit the root configuration (GCS State Bucket & Tofu Override)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# 2. Point to the reusable OpenTofu module (We'll start with networking)
terraform {
  source = "../../../modules/networking"
}

# 3. Pass in the PROD-specific variables
inputs = {
  environment  = "prod"
  project_id   = "f1-visualizer-prod"
  region       = "us-central1"
  network_name = "f1v-vpc-prod"
}
