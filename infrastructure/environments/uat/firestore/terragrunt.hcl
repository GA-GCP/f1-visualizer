include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1v-example-project"
  environment       = "uat"
  database_name     = "f1v-db-uat"
  location_id       = "us-east1"

  delete_protection = "DELETE_PROTECTION_DISABLED"

  # REL-9: a short backup retention so a bad UAT load can be undone, without
  # paying for the PITR write window.
  point_in_time_recovery = false
  backup_retention_days  = 3
}
