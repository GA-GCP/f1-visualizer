include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_user_email = "sa-f1v-user-dev@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-user-dev"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/user:latest-dev"
  service_account_email = dependency.iam.outputs.sa_user_email

  # CPLX-1: reached through the API load balancer's serverless NEG, which
  # cannot present an ID token — so the invoker binding is allUsers and the
  # *.run.app URL is closed off with ingress instead. This is the arrangement
  # telemetry has used since it started bypassing the gateway for WebSockets.
  # The service still validates the Auth0 JWT itself, which is now the only
  # place that happens rather than the second.
  invokers = ["allUsers"]
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # Keep 1 instance warm to eliminate cold-start latency on /users/me.
  # This endpoint is called immediately after splash; a cold-starting JVM
  # adds seconds to the first authenticated request and compounds the
  # rate-limit burst that triggers CORS preflight failures.
  min_instance_count = 1

  # P4: Firestore reads are short; this is the one service where the default
  # is close to right, stated rather than inherited.
  container_concurrency = 80

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "dev"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-dev.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "dev.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-488201"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-dev"
  }
}