include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

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
    network_id = "projects/f1-visualizer-488201/global/networks/f1v-vpc-prod-MOCK"
  }
}

inputs = {
  project_id  = "f1-visualizer-488201"
  environment = "prod"
  region      = "us-central1"

  # A replica and automatic failover. Live telemetry fan-out and replay state both
  # live here, so losing the node mid-session drops every connected browser.
  tier           = "STANDARD_HA"
  memory_size_gb = 1

  # The mock output above allows this reference to resolve during the plan phase
  network_id = dependency.networking.outputs.network_id
}
