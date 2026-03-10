include "root" {
  path = find_in_parent_folders("root.hcl")
}

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
