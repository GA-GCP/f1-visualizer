include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam_and_secrets"
  mock_outputs = {
    sa_user_email = "sa-f1v-user-dev@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-user-dev"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/user:latest"
  service_account_email = dependency.iam.outputs.sa_user_email

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "dev"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://example-okta-org.okta.com/oauth2/example-auth-server-dev"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "dev.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1v-example-project"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-dev"
  }
}