output "sa_cloudbuild_email" {
  value = google_service_account.cloudbuild.email
}

output "sa_data_ingestion_email" {
  value = google_service_account.data_ingestion.email
}

output "sa_telemetry_email" {
  value = google_service_account.telemetry.email
}

output "sa_data_analysis_email" {
  value = google_service_account.data_analysis.email
}

output "sa_user_email" {
  value = google_service_account.user.email
}

output "sa_frontend_email" {
  value = google_service_account.frontend.email
}