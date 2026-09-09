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
    sa_user_email = "sa-f1v-user-prod@f1v-example-project.iam.gserviceaccount.com"
    sa_gateway_email = "sa-f1v-gateway-prod@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-user-prod"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/user:latest"
  service_account_email = dependency.iam.outputs.sa_user_email

  # O3: prod inherited the module's DEV/UAT default of false.
  deletion_protection = true

  # S3: the *.run.app URL no longer answers the internet. Only the API Gateway's
  # service account can invoke this service, and it presents an ID token minted
  # for the service's own URL. In-app JWT validation stays, as defence in depth.
  is_public                = false
  invoker_service_accounts = [dependency.iam.outputs.sa_gateway_email]

  # P4: Firestore reads are short; this is the one service where the default
  # is close to right, stated rather than inherited.
  container_concurrency = 80

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "prod"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1v-example-project"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-prod"
  }
}
