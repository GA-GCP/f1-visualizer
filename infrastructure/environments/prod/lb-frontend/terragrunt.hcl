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

# REL-6: the serverless NEG used to name f1v-webapp-prod as a literal, so
# Terragrunt saw no edge and could apply the load balancer before the service
# existed. First bootstrap of an environment failed on the NEG; later runs
# succeeded by accident of ordering.
dependency "webapp" {
  config_path = "../f1v-webapp"
  mock_outputs = {
    service_name = "f1v-webapp-prod"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id             = "f1v-example-project"
  region                 = "us-central1"
  name_prefix            = "f1v-frontend-prod"
  domain                 = "f1visualizer.com"
  cloud_run_service_name = dependency.webapp.outputs.service_name
}
