include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1-visualizer-488201"
  environment = "dev"
  location    = "US"
}