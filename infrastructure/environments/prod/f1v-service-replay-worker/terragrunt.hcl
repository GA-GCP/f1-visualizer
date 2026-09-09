include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/cloud-run"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_replay_worker_email = "sa-f1v-replay-worker-prod@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    network_name    = "f1v-vpc-prod"
    subnetwork_name = "f1v-vpc-prod-subnet"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "secrets" {
  config_path = "../secrets"
  mock_outputs = {
    openf1_username_secret_id = "f1v-api-openf1-login-user-email"
    openf1_password_secret_id = "f1v-api-openf1-login-user-password"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "redis" {
  config_path = "../redis"
  mock_outputs = {
    redis_host           = "10.0.0.5"
    redis_port           = 6379
    redis_auth_secret_id = "f1v-redis-auth-MOCK"
    redis_ca_secret_id   = "f1v-redis-ca-MOCK"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
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
  region                = "us-central1"
  service_name          = "f1v-service-replay-worker-prod"
  service_account_email = dependency.iam.outputs.sa_replay_worker_email
  image_url             = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/replay-worker:latest-prod"

  # No callers: not public, and unreachable from the internet.
  invokers = []
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  # O3: prod inherited the module's DEV/UAT default of false.
  deletion_protection = true

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
  vpc_network    = dependency.networking.outputs.network_name
  vpc_subnetwork = dependency.networking.outputs.subnetwork_name

  env_vars = {
    "SPRING_DATA_REDIS_HOST" = dependency.redis.outputs.redis_host
    "SPRING_DATA_REDIS_PORT" = dependency.redis.outputs.redis_port
    "SPRING_PROFILES_ACTIVE" = "prod"

    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://elysianarts.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "api.f1visualizer.com"
  }

  secret_env_vars = {
    "SPRING_DATA_REDIS_PASSWORD" = { secret = dependency.redis.outputs.redis_auth_secret_id }

    # REL-3: the per-instance CA chain Memorystore signs its certificate with.
    # Tracked at "latest" like the AUTH string, because both are values GCP
    # rotates for us rather than values a deploy should decide.
    "F1V_REDIS_CA_CERT" = { secret = dependency.redis.outputs.redis_ca_secret_id }

    # The MQTT bridge lives here now, so the OpenF1 credentials do too (S6).
    # SEC-6: the secret ids come from the unit that declares the containers, so a
    # rename cannot leave a service pointing at a secret that no longer exists.
    #
    # `version` is stated rather than left to the module's "latest" default. It
    # is still "latest" today, because the current version numbers are live state
    # this repository does not know — but changing it is now a one-line reviewed
    # diff rather than an edit to a default nobody sees.
    "F1V_OPENF1_USERNAME" = {
      secret  = dependency.secrets.outputs.openf1_username_secret_id
      version = "latest"
    }
    "F1V_OPENF1_PASSWORD" = {
      secret  = dependency.secrets.outputs.openf1_password_secret_id
      version = "latest"
    }
  }
}
