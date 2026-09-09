# ==============================================================================
# lb-frontend — the SPA edge, with Cloud CDN (PERF-2)
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/lb-frontend"
}

dependency "webapp" {
  config_path = "../f1v-webapp"
  mock_outputs = {
    service_name = "f1v-webapp-${local.env.environment}"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region      = local.env.region
  name_prefix = "f1v-frontend-${local.env.environment}"
  domain      = local.env.frontend_domain

  cloud_run_service_name = dependency.webapp.outputs.service_name

  dns_zone_name           = local.env.dns_zone_name
  use_certificate_manager = false
}
