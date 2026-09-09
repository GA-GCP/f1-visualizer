# ==============================================================================
# firestore — user profiles, preferences and ingestion job status
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/firestore"
}

inputs = {
  environment   = local.env.environment
  database_name = local.env.firestore_database_id
  region        = local.env.region

  delete_protection = local.env.is_production

  # REL-9: prod holds the only data here that is not derived from anything.
  point_in_time_recovery = local.env.is_production
  backup_retention_days  = local.env.is_production ? 14 : 0
}
