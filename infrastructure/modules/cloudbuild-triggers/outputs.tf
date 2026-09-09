output "trigger_ids" {
  description = "Map of trigger names to their Cloud Build trigger IDs"
  value = merge(
    { for name, trigger in google_cloudbuild_trigger.backend : "backend_${name}" => trigger.trigger_id },
    {
      frontend       = google_cloudbuild_trigger.frontend.trigger_id
      infrastructure = google_cloudbuild_trigger.infrastructure.trigger_id
    }
  )
}
