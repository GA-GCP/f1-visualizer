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
    sa_user_email = "sa-f1v-user-uat@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-east1"
  service_name = "f1v-service-user-uat"
  image_url    = "us-east1-docker.pkg.dev/f1v-example-project/f1v-repo/user:latest-uat"
  service_account_email = dependency.iam.outputs.sa_user_email

  # CPLX-1: reached through the API load balancer's serverless NEG, which
  # cannot present an ID token — so the invoker binding is allUsers and the
  # *.run.app URL is closed off with ingress instead. This is the arrangement
  # telemetry has used since it started bypassing the gateway for WebSockets.
  # The service still validates the Auth0 JWT itself, which is now the only
  # place that happens rather than the second.
  is_public = true
  ingress   = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # P4: Firestore reads are short; this is the one service where the default
  # is close to right, stated rather than inherited.
  container_concurrency = 80

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "uat"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-uat.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1v-example-project"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-uat"
  }
}
