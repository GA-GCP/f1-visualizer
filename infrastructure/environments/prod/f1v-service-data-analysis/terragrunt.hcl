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
    sa_data_analysis_email = "sa-f1v-data-analysis-prod@f1-visualizer-488201.iam.gserviceaccount.com"
    sa_gateway_email = "sa-f1v-gateway-prod@f1-visualizer-488201.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-data-analysis-prod"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/data-analysis:latest-prod"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  # O3: prod inherited the module's DEV/UAT default of false.
  deletion_protection = true

  # S3: the *.run.app URL no longer answers the internet. Only the API Gateway's
  # service account can invoke this service, and it presents an ID token minted
  # for the service's own URL. In-app JWT validation stays, as defence in depth.
  is_public                = false
  invoker_service_accounts = [dependency.iam.outputs.sa_gateway_email]

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
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-488201"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-prod"
  }
}
