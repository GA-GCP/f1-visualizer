include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/cloud-run-backend"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_analysis_email = "sa-f1v-data-analysis-prod@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-data-analysis-prod"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/data-analysis:latest-prod"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  # O3: prod inherited the module's DEV/UAT default of false.
  deletion_protection = true

  # CPLX-1: reached through the API load balancer's serverless NEG, which
  # cannot present an ID token — so the invoker binding is allUsers and the
  # *.run.app URL is closed off with ingress instead. This is the arrangement
  # telemetry has used since it started bypassing the gateway for WebSockets.
  # The service still validates the Auth0 JWT itself, which is now the only
  # place that happens rather than the second.
  is_public = true
  ingress   = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # P4: each request is a BigQuery round trip. Virtual threads mean they no
  # longer pin a platform thread, but 80 in flight against one vCPU only
  # queues at BigQuery.
  container_concurrency = 40

  # Keep 1 instance warm to eliminate cold-start latency for the dropdown
  # reference data API (/analysis/drivers, /analysis/sessions). The frontend
  # prefetches this data during the splash screen; a cold-starting JVM would
  # negate the prefetch benefit.
  min_instance_count = 1

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "prod"

    # --- NEW: Explicitly inject Auth0 Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1v-example-project"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-prod"
  }
}
