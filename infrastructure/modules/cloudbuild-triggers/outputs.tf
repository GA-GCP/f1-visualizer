output "trigger_ids" {
  description = "Map of trigger names to their Cloud Build trigger IDs"
  value = {
    backend_data_analysis  = google_cloudbuild_trigger.backend_data_analysis.trigger_id
    backend_data_ingestion = google_cloudbuild_trigger.backend_data_ingestion.trigger_id
    backend_telemetry      = google_cloudbuild_trigger.backend_telemetry.trigger_id
    backend_user           = google_cloudbuild_trigger.backend_user.trigger_id
    frontend               = google_cloudbuild_trigger.frontend.trigger_id
    api_gateway            = google_cloudbuild_trigger.api_gateway.trigger_id
    infrastructure         = google_cloudbuild_trigger.infrastructure.trigger_id
  }
}
