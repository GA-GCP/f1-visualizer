resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = var.database_name
  location_id = var.location_id
  type        = "FIRESTORE_NATIVE"

  # Important for non-prod environments to allow teardowns
  delete_protection_state = var.delete_protection
}

# Future-proofing: Placeholder for Composite Indexes
# We will add google_firestore_index resources here later based on your "Error-Driven" discovery plan.