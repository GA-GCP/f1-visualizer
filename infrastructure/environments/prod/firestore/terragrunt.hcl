include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1-visualizer-prod"
  environment       = "prod"
  database_name     = "f1v-db-prod"
  location_id       = "us-central1"

  delete_protection = "DELETE_PROTECTION_ENABLED"
}
