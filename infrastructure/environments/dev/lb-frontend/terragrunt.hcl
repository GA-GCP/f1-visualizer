include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-frontend"
}

# REL-6: the serverless NEG used to name f1v-webapp-dev as a literal, so
# Terragrunt saw no edge and could apply the load balancer before the service
# existed. First bootstrap of an environment failed on the NEG; later runs
# succeeded by accident of ordering.
dependency "webapp" {
  config_path = "../f1v-webapp"
  mock_outputs = {
    service_name = "f1v-webapp-dev"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id             = "f1-visualizer-488201"
  region                 = "us-central1"
  name_prefix            = "f1v-frontend-dev"
  domain                 = "dev.f1visualizer.com"
  cloud_run_service_name = dependency.webapp.outputs.service_name

  # OPS-3 / SEC-5: the zone from infrastructure/platform. The A and AAAA records
  # and the Certificate Manager DNS authorization are created here, where the
  # addresses are.
  dns_zone_name = "f1visualizer-com"

  # SEC-5: flip to true per environment once
  # `gcloud certificate-manager certificates describe` reports ACTIVE. dev first.
  use_certificate_manager = false
}
