# ==============================================================================
# f1v-service-user — Firestore-backed user profile and preferences
# ==============================================================================
# CPLX-3: the shared definition. Everything here was repeated in three
# near-identical unit files; what differs per environment comes from env.hcl, and
# a unit adds only a genuine override.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_user_email = "sa-f1v-user-${local.env.environment}@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region       = local.env.region
  service_name = "f1v-service-user-${local.env.environment}"
  image_url    = "${local.env.registry_host}/${local.env.repository}/user:${local.env.image_tag}"

  service_account_email = dependency.iam.outputs.sa_user_email

  # CPLX-1: reached through the API load balancer's serverless NEG, which cannot
  # present an ID token — so the invoker binding is allUsers and the *.run.app URL
  # is closed off with ingress instead. The service validates the Auth0 JWT
  # itself, which is now the only place that happens rather than the second.
  invokers = ["allUsers"]
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # Keep 1 instance warm to eliminate cold-start latency on /users/me, which is
  # called immediately after splash.
  min_instance_count = local.env.rest_min_instances

  # P4: Firestore reads are short; this is the one service where the default is
  # close to right, stated rather than inherited.
  container_concurrency = 80

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = local.env.environment

    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = local.env.auth0_issuer
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = local.env.auth0_audience

    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = local.env.project_id
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = local.env.firestore_database_id
  }
}
