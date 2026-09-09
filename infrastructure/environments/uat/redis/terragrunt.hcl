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
    network_id = "projects/f1-visualizer-488201/global/networks/f1v-vpc-uat-MOCK"
  }
}

inputs = {
  project_id  = "f1-visualizer-488201"
  environment = "uat"
  region      = "us-east1"

  # Single node, no failover: matches dev deliberately, so the difference between
  # uat and prod is stated here rather than inferred from the environment name.
  tier           = "BASIC"
  memory_size_gb = 1

  # The mock output above allows this reference to resolve during the plan phase
  network_id = dependency.networking.outputs.network_id
}
