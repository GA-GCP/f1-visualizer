output "redis_host" {
  value = google_redis_instance.f1v_cache.host
}

output "redis_port" {
  value = google_redis_instance.f1v_cache.port
}