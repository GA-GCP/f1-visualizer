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
    sa_user_email = "sa-f1v-user-prod@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-user-prod"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/user:latest-prod"
  service_account_email = dependency.iam.outputs.sa_user_email

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

  # P4: Firestore reads are short; this is the one service where the default
  # is close to right, stated rather than inherited.
  container_concurrency = 80

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "prod"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-488201"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-prod"
  }
}
