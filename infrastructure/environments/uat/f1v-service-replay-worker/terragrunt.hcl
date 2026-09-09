include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-backend"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_replay_worker_email = "sa-f1v-replay-worker-uat@f1v-example-project.iam.gserviceaccount.com"
  }
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_access_connector_id = "projects/f1v-example-project/locations/us-east1/connectors/f1v-vpc-uat-conn-MOCK"
  }
}

dependency "redis" {
  config_path = "../redis"
  mock_outputs = {
    redis_host           = "10.0.0.5"
    redis_port           = 6379
    redis_auth_secret_id = "f1v-redis-auth-MOCK"
  }
}

# ==============================================================================
# R1: the replay worker
# ==============================================================================
# The replay engine, its chunk prefetcher and the MQTT bridge are stateful
# singletons. They used to share a deployment with the stateless HTTP loaders,
# where Cloud Run's default of five instances meant a play, pause or seek could
# land on an instance that was not running the replay — and a scale-down threw
# the replay away.
#
# Exactly one instance, always on, with CPU always allocated. It has no HTTP API:
# commands arrive on a Redis stream and state goes back to Redis, so nothing
# outside the platform's own health probes needs to reach it.
inputs = {
  project_id            = "f1v-example-project"
  region                = "us-east1"
  service_name          = "f1v-service-replay-worker-uat"
  service_account_email = dependency.iam.outputs.sa_replay_worker_email
  image_url             = "us-east1-docker.pkg.dev/f1v-example-project/f1v-repo/replay-worker:latest-uat"

  # No callers: not public, and unreachable from the internet.
  is_public = false
  ingress   = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  # Exactly one. This is the whole point of the service.
  min_instance_count = 1
  max_instance_count = 1

  # The 250 ms tick, the chunk prefetch executor and the MQTT callbacks all run
  # between requests — and there are no requests here at all.
  cpu_idle = false

  # 100k-object replay buffers, BigQuery reads and MQTT + Redis I/O.
  cpu    = "2000m"
  memory = "1024Mi"

  # Redis is the command channel, the state store and the packet destination.
  vpc_connector_id = dependency.networking.outputs.vpc_access_connector_id

  env_vars = {
    "SPRING_DATA_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_DATA_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "uat"

    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts-uat.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"
  }

  secret_env_vars = {
    "SPRING_DATA_REDIS_PASSWORD" = { secret = dependency.redis.outputs.redis_auth_secret_id }

    # The MQTT bridge lives here now, so the OpenF1 credentials do too (S6).
    "F1V_OPENF1_USERNAME" = { secret = "f1v-api-openf1-login-user-email" }
    "F1V_OPENF1_PASSWORD" = { secret = "f1v-api-openf1-login-user-password" }
  }
}
