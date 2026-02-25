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
    network_id = "projects/f1v-example-project/global/networks/f1v-vpc-dev-MOCK"
  }
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "dev"
  region      = "us-central1"

  # The mock output above allows this reference to resolve during the plan phase
  network_id  = dependency.networking.outputs.network_id
}