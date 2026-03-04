include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1v-example-prod"
  environment = "prod"
  location    = "US"
}
