include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-api"
}

dependency "api_gateway" {
  config_path = "../api-gateway"
  mock_outputs = {
    default_hostname = "f1v-gateway-uat-placeholder.ue.gateway.dev"
  }
}

inputs = {
  project_id             = "f1-visualizer-488201"
  region                 = "us-east1"
  name_prefix            = "f1v-api-uat"
  domain                 = "uat.api.f1visualizer.com"
  api_gateway_fqdn       = dependency.api_gateway.outputs.default_hostname
  telemetry_service_name = "f1v-service-telemetry-uat"
  frontend_origin        = "https://uat.f1visualizer.com"
}
