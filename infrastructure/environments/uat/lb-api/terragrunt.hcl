include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-api"
}

# CPLX-1 / REL-6: the NEGs used to name their Cloud Run services as bare strings,
# so Terragrunt saw no edge between this unit and the services and could apply the
# load balancer before they existed. These are real dependencies now.
dependency "user" {
  config_path = "../f1v-service-user"
  mock_outputs = {
    service_name = "f1v-service-user-uat"
  }
}

dependency "analysis" {
  config_path = "../f1v-service-data-analysis"
  mock_outputs = {
    service_name = "f1v-service-data-analysis-uat"
  }
}

dependency "ingestion" {
  config_path = "../f1v-service-data-ingestion"
  mock_outputs = {
    service_name = "f1v-service-data-ingestion-uat"
  }
}

dependency "telemetry" {
  config_path = "../f1v-service-telemetry"
  mock_outputs = {
    service_name = "f1v-service-telemetry-uat"
  }
}

inputs = {
  project_id      = "f1v-example-project"
  region          = "us-east1"
  name_prefix     = "f1v-api-uat"
  domain          = "uat.api.f1visualizer.com"
  frontend_origin = "https://uat.f1visualizer.com"

  user_service_name      = dependency.user.outputs.service_name
  analysis_service_name  = dependency.analysis.outputs.service_name
  ingestion_service_name = dependency.ingestion.outputs.service_name
  telemetry_service_name = dependency.telemetry.outputs.service_name
}
