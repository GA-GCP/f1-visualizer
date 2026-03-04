include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1v-example-uat"
  environment = "uat"
  location    = "US"
}
