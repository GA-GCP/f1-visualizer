include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/monitoring"
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "prod"

  frontend_domain = "f1visualizer.com"
  api_domain      = "api.f1visualizer.com"

  redis_instance_id = "f1v-redis-prod"

  # Enabled.
  alerts_enabled = true

  # OPS-1: an alert with no channel is a graph nobody looks at. Fill this in —
  # it is the one input here that cannot be derived from the rest of the tree.
  notification_emails = []

  # OPS-1: the budget needs a billing account id, which is not discoverable from
  # this repository. Empty means no budget is created; set it and the 50/90/100
  # percent thresholds start reporting.
  billing_account    = ""
  monthly_budget_usd = 400
}
