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
    sa_data_analysis_email = "sa-f1v-data-analysis-prod@f1-visualizer-prod.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1-visualizer-prod"
  region       = "us-central1"
  service_name = "f1v-service-data-analysis-prod"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-prod/f1v-repo/data-analysis:latest"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  is_public    = true

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
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-prod"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-prod"
  }
}
