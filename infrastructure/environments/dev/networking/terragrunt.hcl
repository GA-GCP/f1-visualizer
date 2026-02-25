# 1. Inherit the root configuration (GCS State Bucket & Tofu Override)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# 2. Point to the reusable OpenTofu module (We'll start with networking)
terraform {
  source = "../../../modules/networking"
}

# 3. Pass in the DEV-specific variables
inputs = {
  environment  = "dev"
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  network_name = "f1v-vpc-dev"
}