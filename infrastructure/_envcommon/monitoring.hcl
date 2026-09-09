# ==============================================================================
# monitoring — uptime checks, alert policies and a budget (OPS-1)
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/monitoring"
}

inputs = {
  environment = local.env.environment

  frontend_domain = local.env.frontend_domain
  api_domain      = local.env.api_domain

  redis_instance_id = "f1v-redis-${local.env.environment}"

  # OPS-1: an alert with no channel is a graph nobody looks at. Fill this in —
  # it is the one input here that cannot be derived from the rest of the tree.
  notification_emails = []

  # OPS-1: the budget needs a billing account id, which is not discoverable from
  # this repository. Empty means no budget is created.
  billing_account = ""
}
