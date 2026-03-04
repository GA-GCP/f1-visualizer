include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1-visualizer-uat"
  environment = "uat"
  location    = "US"
}
