include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-api"
}

inputs = {
  project_id             = "f1-visualizer-uat"
  name_prefix            = "f1v-api-uat"
  domain                 = "uat.api.f1visualizer.com"
  api_gateway_fqdn       = "f1v-gateway-uat-placeholder.uc.gateway.dev"
  telemetry_service_name = "f1v-service-telemetry-uat"
}
