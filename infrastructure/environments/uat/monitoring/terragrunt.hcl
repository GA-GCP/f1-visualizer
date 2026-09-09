include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/monitoring"
}

inputs = {
  project_id  = "f1-visualizer-488201"
  environment = "uat"

  frontend_domain = "uat.f1visualizer.com"
  api_domain      = "uat.api.f1visualizer.com"

  redis_instance_id = "f1v-redis-uat"

  # Enabled: uat is where a release is supposed to fail before prod does.
  alerts_enabled = true

  # OPS-1: an alert with no channel is a graph nobody looks at. Fill this in —
  # it is the one input here that cannot be derived from the rest of the tree.
  notification_emails = []

  # OPS-1: the budget needs a billing account id, which is not discoverable from
  # this repository. Empty means no budget is created; set it and the 50/90/100
  # percent thresholds start reporting.
  billing_account    = ""
  monthly_budget_usd = 300
}
