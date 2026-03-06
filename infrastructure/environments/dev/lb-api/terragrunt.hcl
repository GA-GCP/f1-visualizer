include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-api"
}

inputs = {
  project_id             = "f1-visualizer-488201"
  name_prefix            = "f1v-api-dev"
  domain                 = "dev.api.f1visualizer.com"
  api_gateway_fqdn       = "f1v-gateway-dev-2udaafhz.uc.gateway.dev"
  telemetry_service_name = "f1v-service-telemetry-dev"
  frontend_origin        = "https://dev.f1visualizer.com"
}