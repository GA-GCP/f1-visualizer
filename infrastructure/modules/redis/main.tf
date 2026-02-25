resource "google_redis_instance" "f1v_cache" {
  name           = "f1v-redis-${var.environment}"
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = 1

  region                  = var.region
  authorized_network      = var.network_id
  connect_mode            = "DIRECT_PEERING"

  redis_version = "REDIS_6_X"
  display_name  = "F1V Live Telemetry Cache (${var.environment})"

  labels = {
    env = var.environment
  }
}