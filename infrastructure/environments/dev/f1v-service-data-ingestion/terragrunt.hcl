include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam_and_secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-dev@f1v-example-project.iam.gserviceaccount.com"
  }
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_access_connector_id = "projects/f1v-example-project/locations/us-central1/connectors/f1v-vpc-dev-conn-MOCK"
  }
}

dependency "redis" {
  config_path = "../redis"
  mock_outputs = {
    redis_host = "10.0.0.5"
    redis_port = 6379
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-data-ingestion-dev"
  service_account_email = dependency.iam.outputs.sa_data_ingestion_email
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/data-ingestion:latest"

  # Needs VPC access to write to Redis
  vpc_connector_id = dependency.networking.outputs.vpc_access_connector_id

  env_vars = {
    "SPRING_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "dev"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://example-okta-org.okta.com/oauth2/example-auth-server-dev"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "dev.api.f1visualizer.com"
  }
}