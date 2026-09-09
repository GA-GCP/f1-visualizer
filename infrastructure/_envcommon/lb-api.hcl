# ==============================================================================
# lb-api — the API edge (CPLX-1: no gateway behind it)
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/lb-api"
}

dependency "user" {
  config_path = "../f1v-service-user"
  mock_outputs = {
    service_name = "f1v-service-user-${local.env.environment}"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "analysis" {
  config_path = "../f1v-service-data-analysis"
  mock_outputs = {
    service_name = "f1v-service-data-analysis-${local.env.environment}"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "ingestion" {
  config_path = "../f1v-service-data-ingestion"
  mock_outputs = {
    service_name = "f1v-service-data-ingestion-${local.env.environment}"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "telemetry" {
  config_path = "../f1v-service-telemetry"
  mock_outputs = {
    service_name = "f1v-service-telemetry-${local.env.environment}"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region          = local.env.region
  name_prefix     = "f1v-api-${local.env.environment}"
  domain          = local.env.api_domain
  frontend_origin = local.env.frontend_origin

  # REL-6: real dependency edges. These used to be bare service-name strings, so
  # Terragrunt could apply the load balancer before the services existed.
  user_service_name      = dependency.user.outputs.service_name
  analysis_service_name  = dependency.analysis.outputs.service_name
  ingestion_service_name = dependency.ingestion.outputs.service_name
  telemetry_service_name = dependency.telemetry.outputs.service_name

  # OPS-3 / SEC-5: the zone from infrastructure/platform. The A and AAAA records
  # and the Certificate Manager DNS authorization are created here, where the
  # addresses are.
  dns_zone_name = local.env.dns_zone_name

  # SEC-5: flip per environment once the managed certificate reports ACTIVE.
  # See MIGRATIONS.md.
  use_certificate_manager = false
}
