include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/lb-api"
}

dependency "api_gateway" {
  config_path = "../api-gateway"
  mock_outputs = {
    default_hostname = "f1v-gateway-prod-placeholder.uc.gateway.dev"
  }
}

inputs = {
  project_id             = "f1-visualizer-488201"
  region                 = "us-central1"
  name_prefix            = "f1v-api-prod"
  domain                 = "api.f1visualizer.com"
  api_gateway_fqdn       = dependency.api_gateway.outputs.default_hostname
  telemetry_service_name = "f1v-service-telemetry-prod"
  frontend_origin        = "https://f1visualizer.com"
}
