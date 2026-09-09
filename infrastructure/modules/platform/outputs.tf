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

# DLV-1: the two values the PR workflow needs, as repository variables
# WIF_PROVIDER and PLANNER_SERVICE_ACCOUNT.
output "wif_provider" {
  description = "Full resource name of the OIDC provider, for google-github-actions/auth."
  value       = try(google_iam_workload_identity_pool_provider.github[0].name, "")
}

output "planner_service_account" {
  description = "Email the pull-request plan impersonates."
  value       = try(google_service_account.planner[0].email, "")
}

output "cloudbuild_repository_id" {
  description = "Resource id of the 2nd-gen repository, for a trigger's repository_event_config. Empty while the connection is unmanaged (CPLX-8)."
  value       = try(google_cloudbuildv2_repository.repo[0].id, "")
}
