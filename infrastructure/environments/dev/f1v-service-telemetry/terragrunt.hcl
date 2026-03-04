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
    sa_telemetry_email = "sa-f1v-telemetry-dev@f1-visualizer-488201.iam.gserviceaccount.com"
  }
}

# 2. Dependency on Networking (For VPC Access Connector)
dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_access_connector_id = "projects/f1-visualizer-488201/locations/us-central1/connectors/f1v-vpc-dev-conn-MOCK"
  }
}

# 3. Dependency on Redis (For Host/Port Environment Variables)
dependency "redis" {
  config_path = "../redis"
  mock_outputs = {
    redis_host = "10.0.0.5"
    redis_port = 6379
  }
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-telemetry-dev"
  service_account_email = dependency.iam.outputs.sa_telemetry_email

  is_public    = true

  # Pointing to the Artifact Registry repo we created
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/telemetry:latest"

  # Elevated resources: high-frequency Redis Pub/Sub to WebSocket broadcast (1000+ msg/sec during live sessions)
  cpu    = "2000m"
  memory = "1024Mi"

  # Keep 1 instance warm to eliminate cold-start delays on WebSocket connections.
  # The frontend establishes a STOMP/SockJS connection immediately after login;
  # a cold-starting backend causes transient connection failures.
  min_instance_count = 1

  # Critical for WebSocket Performance
  container_concurrency = 1000
  vpc_connector_id      = dependency.networking.outputs.vpc_access_connector_id

  env_vars = {
    "SPRING_DATA_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_DATA_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "dev"

    # --- NEW: Explicitly inject Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-dev.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "dev.api.f1visualizer.com"
  }
}