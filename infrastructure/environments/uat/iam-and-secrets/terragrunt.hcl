# 1. Inherit the root configuration (GCS State Bucket & Tofu Override)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# 2. Point to the reusable OpenTofu module we just created
terraform {
  source = "../../../modules/iam-and-secrets"
}

# 3. Pass in the UAT-specific variables
inputs = {
  environment = "uat"
  project_id  = "f1-visualizer-488201"

  # SEC-3: the database the conditioned roles/datastore.user binding allows.
  firestore_database_id = "f1v-db-uat"
}
