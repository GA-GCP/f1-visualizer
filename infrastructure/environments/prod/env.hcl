# ==============================================================================
# prod — production
# ==============================================================================
# CPLX-3: every fact that is true of this environment and only this environment,
# stated once. root.hcl reads this file, _envcommon/*.hcl build the units from
# it, and a unit under this directory holds only what differs from the shared
# definition.
#
# The diff between two environments used to be 13 to 27 lines per service unit,
# buried in prose comments. It is now this file.

locals {
  environment = "prod"
  project_id  = "f1v-example-project"
  region      = "us-central1"

  # REL-8 / CPLX-3: one flag, rather than deletion_protection, delete_protection
  # and prevent_destroy each being remembered separately per unit.
  is_production = true

  # --- Identity -------------------------------------------------------------
  auth0_issuer   = "https://elysianarts.us.auth0.com/"
  auth0_audience = "api.f1visualizer.com"

  # --- Data -----------------------------------------------------------------
  firestore_database_id = "f1v-db-prod"
  bigquery_dataset_id   = "f1_dataset_prod"

  # --- Images ---------------------------------------------------------------
  # REL-1: the tag carries the environment, so dev, uat and prod stop sharing
  # one `:latest` in the registries they share.
  registry_host = "us-central1-docker.pkg.dev"
  repository    = "f1v-example-project/f1v-repo"
  image_tag     = "latest-prod"

  # --- Edge -----------------------------------------------------------------
  frontend_domain = "f1visualizer.com"
  api_domain      = "api.f1visualizer.com"
  frontend_origin = "https://f1visualizer.com"
  dns_zone_name   = "f1visualizer-com"

  # --- Networking -----------------------------------------------------------
  network_name = "f1v-vpc-prod"
  subnet_cidr  = "10.0.0.0/24"

  # --- Delivery -------------------------------------------------------------
  github_owner   = "GA-GCP"
  github_repo    = "f1-visualizer"
  branch_pattern = "^prod$"

  # --- Identities (SEC-1) ---------------------------------------------------
  # Named by convention where a cross-layer reference is needed; every
  # same-environment reference goes through a dependency output.
  deploy_service_account = "sa-f1v-deploy-prod@f1v-example-project.iam.gserviceaccount.com"

  # --- Sizing --------------------------------------------------------------
  # PERF-4: unchanged in prod. The warm instances buy latency for the splash
  # screen prefetch, and PERF-7 put a CDN in front of the six reference
  # endpoints, which is what would make scaling analysis to zero viable next.
  rest_min_instances  = 1
  telemetry_warm      = true
  worker_enabled      = true
}
