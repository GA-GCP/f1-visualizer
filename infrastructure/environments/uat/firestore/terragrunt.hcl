include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1-visualizer-uat"
  environment       = "uat"
  database_name     = "f1v-db-uat"
  location_id       = "us-central1"

  delete_protection = "DELETE_PROTECTION_DISABLED"
}
