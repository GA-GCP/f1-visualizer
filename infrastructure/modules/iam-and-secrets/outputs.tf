output "sa_deploy_email" {
  description = "Identity the backend and frontend pipelines run as (SEC-1)."
  value       = google_service_account.deploy.email
}

output "sa_infra_email" {
  description = "Identity the infrastructure pipeline runs as (SEC-1)."
  value       = google_service_account.infra.email
}

output "sa_data_ingestion_email" {
  description = "Identity the ingestion service runs as."
  value       = google_service_account.data_ingestion.email
}

output "sa_replay_worker_email" {
  description = "Identity the replay worker runs as."
  value       = google_service_account.replay_worker.email
}

output "sa_telemetry_email" {
  description = "Identity the telemetry broker runs as."
  value       = google_service_account.telemetry.email
}

output "sa_data_analysis_email" {
  description = "Identity the analysis service runs as."
  value       = google_service_account.data_analysis.email
}

output "sa_user_email" {
  description = "Identity the user service runs as."
  value       = google_service_account.user.email
}

output "sa_frontend_email" {
  description = "Identity the SPA runs as. Holds no bindings anywhere, by design (SEC-2)."
  value       = google_service_account.frontend.email
}
