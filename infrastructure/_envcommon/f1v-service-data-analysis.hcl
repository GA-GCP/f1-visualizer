# ==============================================================================
# f1v-service-data-analysis — BigQuery-backed REST API
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
    sa_data_analysis_email = "sa-f1v-data-analysis-${local.env.environment}@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "bigquery" {
  config_path = "../bigquery"
  mock_outputs = {
    dataset_id = local.env.bigquery_dataset_id
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  region       = local.env.region
  service_name = "f1v-service-data-analysis-${local.env.environment}"
  image_url    = "${local.env.registry_host}/${local.env.repository}/data-analysis:${local.env.image_tag}"

  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  # CPLX-1: reached through the API load balancer's serverless NEG, which cannot
  # present an ID token — so the invoker binding is allUsers and the *.run.app URL
  # is closed off with ingress instead. The service validates the Auth0 JWT
  # itself, which is now the only place that happens rather than the second.
  invokers = ["allUsers"]
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # Keep 1 instance warm for the dropdown reference data the frontend prefetches
  # during the splash screen. PERF-7 put a CDN in front of those six endpoints,
  # which is what makes scaling this to zero viable (PERF-4).
  min_instance_count = local.env.rest_min_instances

  # P4: each request is a BigQuery round trip. Virtual threads mean they no
  # longer pin a platform thread, but 80 in flight against one vCPU only queues
  # at BigQuery.
  container_concurrency = 40

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = local.env.environment

    # CPLX-2: the backend has read this since C4 and nothing ever set it, so
    # every environment fell through to one shared dataset.
    "F1V_BIGQUERY_DATASET" = dependency.bigquery.outputs.dataset_id

    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = local.env.auth0_issuer
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = local.env.auth0_audience

    "SPRING_CLOUD_GCP_FIRESTORE_PROJECT_ID"  = local.env.project_id
    "SPRING_CLOUD_GCP_FIRESTORE_DATABASE_ID" = local.env.firestore_database_id
  }
}
