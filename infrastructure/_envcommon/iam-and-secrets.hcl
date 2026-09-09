# ==============================================================================
# iam-and-secrets — every identity in the environment
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/iam-and-secrets"
}

inputs = {
  environment = local.env.environment

  # SEC-3: the database this environment's conditioned roles/datastore.user
  # binding allows, so sa-f1v-user-dev cannot write to f1v-db-prod.
  firestore_database_id = local.env.firestore_database_id
}
