include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/monitoring"
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "dev"

  frontend_domain = "dev.f1visualizer.com"
  api_domain      = "dev.api.f1visualizer.com"

  redis_instance_id = "f1v-redis-dev"

  # OPS-1: policies are created but not enabled in dev. An environment with
  # no users overnight pages on its own quiet, which trains people to ignore
  # the channel. The thresholds are still here to be reviewed and to be the
  # same ones prod uses.
  alerts_enabled = false

  # OPS-1: an alert with no channel is a graph nobody looks at. Fill this in —
  # it is the one input here that cannot be derived from the rest of the tree.
  notification_emails = []

  # OPS-1: the budget needs a billing account id, which is not discoverable from
  # this repository. Empty means no budget is created; set it and the 50/90/100
  # percent thresholds start reporting.
  billing_account    = ""
  monthly_budget_usd = 300
}
