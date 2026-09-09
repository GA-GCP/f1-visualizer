include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/firestore"
}

inputs = {
  project_id        = "f1v-example-project"
  environment       = "prod"
  database_name     = "f1v-db-prod"
  location_id       = "us-central1"

  delete_protection = "DELETE_PROTECTION_ENABLED"
}
