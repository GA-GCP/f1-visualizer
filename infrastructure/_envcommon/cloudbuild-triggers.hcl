# ==============================================================================
# cloudbuild-triggers — five backend pipelines, the frontend, the infrastructure
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/cloudbuild-triggers"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_deploy_email = "sa-f1v-deploy-${local.env.environment}@f1-visualizer-488201.iam.gserviceaccount.com"
    sa_infra_email  = "sa-f1v-infra-${local.env.environment}@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region         = local.env.region
  environment    = local.env.environment
  github_owner   = local.env.github_owner
  github_repo    = local.env.github_repo
  branch_pattern = local.env.branch_pattern

  # SEC-1: two identities. The one that runs `./mvnw verify` and `yarn install`
  # cannot change IAM; the one that runs terragrunt does not run third-party code.
  deploy_service_account_email = dependency.iam.outputs.sa_deploy_email
  infra_service_account_email  = dependency.iam.outputs.sa_infra_email

  # CPLX-8: empty keeps the 1st-gen github block. When the platform layer creates
  # the connection, set this to its `cloudbuild_repository_id` output — it is
  # written out rather than read from a dependency, because depending across the
  # layer boundary would pull the platform unit into an environment's `run --all`.
  cloudbuild_repository_id = ""
}
