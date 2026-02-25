include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

# 1. Dependency on Networking (For VPC Access Connector)
dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_access_connector_id = "projects/f1-visualizer-488201/locations/us-central1/connectors/f1v-vpc-dev-conn-MOCK"
  }
}

# 2. Dependency on Redis (For Host/Port Environment Variables)
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

  # Pointing to the Artifact Registry repo we created
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/telemetry:latest"

  # Critical for WebSocket Performance
  container_concurrency = 1000
  vpc_connector_id      = dependency.networking.outputs.vpc_access_connector_id

  env_vars = {
    "SPRING_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "dev"
  }
}