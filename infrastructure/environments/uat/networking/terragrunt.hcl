# 1. Inherit the root configuration (GCS State Bucket & Tofu Override)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# 2. Point to the reusable OpenTofu module (We'll start with networking)
terraform {
  source = "../../../modules/networking"
}

# 3. Pass in the UAT-specific variables
inputs = {
  environment  = "uat"
  project_id   = "f1-visualizer-uat"
  region       = "us-central1"
  network_name = "f1v-vpc-uat"
}
