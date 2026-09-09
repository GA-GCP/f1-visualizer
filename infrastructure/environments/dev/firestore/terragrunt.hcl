include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1v-example-project"
  environment       = "dev"
  database_name     = "f1v-db-dev"
  location_id       = "us-central1"

  delete_protection = "DELETE_PROTECTION_DISABLED"

  # REL-9: dev data is reloadable from OpenF1 in minutes, and PITR bills against
  # write volume. No backups here is a decision, not an oversight.
  point_in_time_recovery = false
  backup_retention_days  = 0
}
