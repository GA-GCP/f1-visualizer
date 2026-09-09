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
    sa_data_analysis_email = "sa-f1v-data-analysis-uat@f1-visualizer-488201.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "bigquery" {
  config_path = "../bigquery"
  mock_outputs = {
    dataset_id = "f1_dataset_uat"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-east1"
  service_name = "f1v-service-data-analysis-uat"
  image_url    = "us-east1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/data-analysis:latest-uat"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  # CPLX-1: reached through the API load balancer's serverless NEG, which
  # cannot present an ID token — so the invoker binding is allUsers and the
  # *.run.app URL is closed off with ingress instead. This is the arrangement
  # telemetry has used since it started bypassing the gateway for WebSockets.
  # The service still validates the Auth0 JWT itself, which is now the only
  # place that happens rather than the second.
  invokers = ["allUsers"]
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

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
    "SPRING_PROFILES_ACTIVE" = "uat"

    # CPLX-2: the backend has read this since C4 and nothing ever set it, so
    # every environment fell through to the shared "f1_dataset".
    "F1V_BIGQUERY_DATASET" = dependency.bigquery.outputs.dataset_id

    # --- NEW: Explicitly inject Auth0 Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-uat.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"

    # --- NEW: Explicitly inject Firestore Properties ---
    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = "f1-visualizer-488201"
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = "f1v-db-uat"
  }
}
