output "dataset_id" {
  description = "Dataset id, read by the services as F1V_BIGQUERY_DATASET."
  value       = google_bigquery_dataset.f1_dataset.dataset_id
}