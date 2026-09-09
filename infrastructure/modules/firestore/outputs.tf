output "database_name" {
  description = "Database name, e.g. f1v-db-dev."
  value       = google_firestore_database.database.name
}

output "database_id" {
  description = "Fully-qualified database id."
  value       = google_firestore_database.database.id
}