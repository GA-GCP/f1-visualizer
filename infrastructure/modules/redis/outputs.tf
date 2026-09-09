output "redis_host" {
  value = google_redis_instance.f1v_cache.host
}

output "redis_port" {
  value = google_redis_instance.f1v_cache.port
}

output "redis_auth_secret_id" {
  description = "Secret Manager secret holding the Memorystore AUTH string. Mount it as SPRING_DATA_REDIS_PASSWORD."
  value       = google_secret_manager_secret.redis_auth.secret_id
}

output "redis_ca_secret_id" {
  description = "Secret holding the instance's CA certificate chain in PEM form. Mount it as F1V_REDIS_CA_CERT; the services trust it through a Spring SSL bundle (REL-3)."
  value       = google_secret_manager_secret.redis_ca.secret_id
}
