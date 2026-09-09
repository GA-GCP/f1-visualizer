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
    service_name = "f1v-service-user-dev"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "analysis" {
  config_path = "../f1v-service-data-analysis"
  mock_outputs = {
    service_name = "f1v-service-data-analysis-dev"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "ingestion" {
  config_path = "../f1v-service-data-ingestion"
  mock_outputs = {
    service_name = "f1v-service-data-ingestion-dev"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "telemetry" {
  config_path = "../f1v-service-telemetry"
  mock_outputs = {
    service_name = "f1v-service-telemetry-dev"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id      = "f1v-example-project"
  region          = "us-central1"
  name_prefix     = "f1v-api-dev"
  domain          = "dev.api.f1visualizer.com"
  frontend_origin = "https://dev.f1visualizer.com"

  user_service_name      = dependency.user.outputs.service_name
  analysis_service_name  = dependency.analysis.outputs.service_name
  ingestion_service_name = dependency.ingestion.outputs.service_name
  telemetry_service_name = dependency.telemetry.outputs.service_name

  # OPS-3 / SEC-5: the zone from infrastructure/platform. The A and AAAA records
  # and the Certificate Manager DNS authorization are created here, where the
  # addresses are.
  dns_zone_name = "f1visualizer-com"

  # SEC-5: flip to true per environment once
  # `gcloud certificate-manager certificates describe` reports ACTIVE. dev first.
  use_certificate_manager = false
}
