output "registry_hosts" {
  description = "Registry host per entry in var.registries, e.g. us-central1-docker.pkg.dev."
  value       = { for k, r in google_artifact_registry_repository.repo : k => "${r.location}-docker.pkg.dev" }
}

output "repository_id" {
  description = "Artifact Registry repository id."
  value       = var.repository_id
}

output "shared_secret_ids" {
  description = "The shared secret containers, keyed by id."
  value       = { for k, s in google_secret_manager_secret.shared : k => s.secret_id }
}

output "dns_zone_name" {
  description = "Managed zone name the environment units add their records to. Empty when no zone is managed here."
  value       = var.dns_zone_name
}
