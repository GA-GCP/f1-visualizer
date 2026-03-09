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
    sa_user_email = "sa-f1v-user-uat@f1-visualizer-488201.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-user-uat"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/user:latest"
  service_account_email = dependency.iam.outputs.sa_user_email

  is_public    = true

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "uat"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-uat.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-488201"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-uat"
  }
}
