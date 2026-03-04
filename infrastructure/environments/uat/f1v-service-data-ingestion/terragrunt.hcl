include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_ingestion_email = "sa-f1v-data-ingestion-uat@f1-visualizer-uat.iam.gserviceaccount.com"
  }
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_access_connector_id = "projects/f1-visualizer-uat/locations/us-central1/connectors/f1v-vpc-uat-conn-MOCK"
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
  project_id   = "f1-visualizer-uat"
  region       = "us-central1"
  service_name = "f1v-service-data-ingestion-uat"
  service_account_email = dependency.iam.outputs.sa_data_ingestion_email
  image_url    = get_env("TF_VAR_image_url", "us-central1-docker.pkg.dev/f1-visualizer-uat/f1v-repo/data-ingestion:latest")

  is_public    = true

  # Elevated resources: batch BigQuery inserts, 100K-object replay buffers, MQTT + Redis I/O
  cpu    = "2000m"
  memory = "1024Mi"

  # Needs VPC access to write to Redis
  vpc_connector_id = dependency.networking.outputs.vpc_access_connector_id

  env_vars = {
    "SPRING_DATA_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_DATA_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "uat"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://uat-f1visualizer.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"
  }
}
