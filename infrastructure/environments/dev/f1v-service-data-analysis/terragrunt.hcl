include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-backend"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_analysis_email = "sa-f1v-data-analysis-dev@f1v-example-project.iam.gserviceaccount.com"
    sa_gateway_email = "sa-f1v-gateway-dev@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-data-analysis-dev"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/data-analysis:latest-dev"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  # S3: the *.run.app URL no longer answers the internet. Only the API Gateway's
  # service account can invoke this service, and it presents an ID token minted
  # for the service's own URL. In-app JWT validation stays, as defence in depth.
  is_public                = false
  invoker_service_accounts = [dependency.iam.outputs.sa_gateway_email]

  # Keep 1 instance warm to eliminate cold-start latency for the dropdown
  # reference data API (/analysis/drivers, /analysis/sessions). The frontend
  # prefetches this data during the splash screen; a cold-starting JVM would
  # negate the prefetch benefit.
  min_instance_count = 1

  # P4: each request is a BigQuery round trip. Virtual threads mean they no
  # longer pin a platform thread, but 80 in flight against one vCPU only
  # queues at BigQuery.
  container_concurrency = 40

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "dev"

    # --- NEW: Explicitly inject Auth0 Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-dev.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "dev.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1v-example-project"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-dev"
  }
}