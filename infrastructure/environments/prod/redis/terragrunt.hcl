include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/redis"
}

dependency "networking" {
  config_path = "../networking"

  # -----------------------------------------------------------
  # FIX: Mock Outputs for "run-all plan"
  # This allows the plan to succeed even if the network hasn't been created yet.
  # -----------------------------------------------------------
  mock_outputs = {
    network_id = "projects/f1-visualizer-prod/global/networks/f1v-vpc-prod-MOCK"
  }
}

inputs = {
  project_id  = "f1-visualizer-prod"
  environment = "prod"
  region      = "us-central1"

  # HA tier for production reliability
  tier        = "STANDARD_HA"

  # The mock output above allows this reference to resolve during the plan phase
  network_id  = dependency.networking.outputs.network_id
}
