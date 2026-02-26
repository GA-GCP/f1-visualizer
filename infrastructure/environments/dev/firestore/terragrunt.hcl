include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1-visualizer-488201"
  environment       = "dev"
  database_name     = "f1v-db-dev"
  location_id       = "us-central1"

  delete_protection = "DELETE_PROTECTION_DISABLED"
}