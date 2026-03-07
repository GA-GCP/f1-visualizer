resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = var.database_name
  location_id = var.location_id
  type        = "FIRESTORE_NATIVE"

  # Important for non-prod environments to allow teardowns
  delete_protection_state = var.delete_protection
}

# Composite index for querying race entry rosters by year and session
resource "google_firestore_index" "race_entries_by_year" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "reference_race_entries"

  fields {
    field_path = "year"
    order      = "DESCENDING"
  }

  fields {
    field_path = "sessionKey"
    order      = "DESCENDING"
  }
}