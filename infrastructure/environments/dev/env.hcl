# ==============================================================================
# dev — the day-to-day environment; everything here is reloadable
# ==============================================================================
# CPLX-3: every fact that is true of this environment and only this environment,
# stated once. root.hcl reads this file, _envcommon/*.hcl build the units from
# it, and a unit under this directory holds only what differs from the shared
# definition.
#
# The diff between two environments used to be 13 to 27 lines per service unit,
# buried in prose comments. It is now this file.

locals {
  environment = "dev"
  project_id  = "f1-visualizer-488201"
  region      = "us-central1"

  # REL-8 / CPLX-3: one flag, rather than deletion_protection, delete_protection
  # and prevent_destroy each being remembered separately per unit.
  is_production = false

  # --- Identity -------------------------------------------------------------
  auth0_issuer   = "https://elysianarts-dev.us.auth0.com/"
  auth0_audience = "dev.api.f1visualizer.com"

  # --- Data -----------------------------------------------------------------
  firestore_database_id = "f1v-db-dev"
  bigquery_dataset_id   = "f1_dataset_dev"

  # --- Images ---------------------------------------------------------------
  # REL-1: the tag carries the environment, so dev, uat and prod stop sharing
  # one `:latest` in the registries they share.
  registry_host = "us-central1-docker.pkg.dev"
  repository    = "f1-visualizer-488201/f1v-repo"
  image_tag     = "latest-dev"

  # --- Edge -----------------------------------------------------------------
  frontend_domain = "dev.f1visualizer.com"
  api_domain      = "dev.api.f1visualizer.com"
  frontend_origin = "https://dev.f1visualizer.com"
  dns_zone_name   = "f1visualizer-com"

  # --- Networking -----------------------------------------------------------
  network_name = "f1v-vpc-dev"
  subnet_cidr  = "10.0.0.0/24"

  # --- Delivery -------------------------------------------------------------
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^dev$"

  # --- Identities (SEC-1) ---------------------------------------------------
  # Named by convention where a cross-layer reference is needed; every
  # same-environment reference goes through a dependency output.
  deploy_service_account = "sa-f1v-deploy-dev@f1-visualizer-488201.iam.gserviceaccount.com"

  # --- Sizing ---------------------------------------------------------------
  # PERF-4 is where these stop being the same in every environment.
  rest_min_instances = 1
  worker_enabled     = true
}
