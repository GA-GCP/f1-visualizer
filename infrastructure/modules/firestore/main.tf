# CPLX-6: prod must not be able to lose this by accident, and a module that lets
# a caller forget is a module that will eventually be asked why.
resource "google_firestore_database" "database" {
  lifecycle {
    precondition {
      condition     = var.environment != "prod" || var.delete_protection
      error_message = "prod requires delete_protection = true."
    }
  }

  project     = var.project_id
  name        = var.database_name
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Important for non-prod environments to allow teardowns
  delete_protection_state = var.delete_protection ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"

  # REL-9: without this, a bad write to user preferences or reference data is
  # unrecoverable — there is no undo and no earlier copy. PITR gives a seven-day
  # read window at any microsecond.
  point_in_time_recovery_enablement = var.point_in_time_recovery ? "POINT_IN_TIME_RECOVERY_ENABLED" : "POINT_IN_TIME_RECOVERY_DISABLED"
}

# REL-9: PITR covers the last seven days; a scheduled backup is what survives
# past that and past the database itself being deleted.
resource "google_firestore_backup_schedule" "daily" {
  count = var.backup_retention_days > 0 ? 1 : 0

  project   = var.project_id
  database  = google_firestore_database.database.name
  retention = "${var.backup_retention_days * 24 * 60 * 60}s"

  daily_recurrence {}
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