resource "google_project_iam_member" "bad_secret" {
  project = var.project_id
  # ruleid: f1v-project-level-data-role
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:sa@example.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "bad_bq" {
  project = var.project_id
  # ruleid: f1v-project-level-data-role
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:sa@example.iam.gserviceaccount.com"
}

# ok: f1v-project-level-data-role
resource "google_project_iam_member" "conditioned" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:sa@example.iam.gserviceaccount.com"

  condition {
    title      = "only-this-environment-database"
    expression = "resource.name.startsWith(\"projects/p/databases/d\")"
  }
}

# ok: f1v-project-level-data-role
resource "google_project_iam_member" "job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:sa@example.iam.gserviceaccount.com"
}

# ok: f1v-project-level-data-role
resource "google_secret_manager_secret_iam_member" "scoped" {
  secret_id = google_secret_manager_secret.redis_auth.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:sa@example.iam.gserviceaccount.com"
}

variable "images" {
  # ruleid: f1v-floating-latest-image
  bad = "us-central1-docker.pkg.dev/p/f1v-repo/telemetry:latest"
  # ok: f1v-floating-latest-image
  good = "us-central1-docker.pkg.dev/p/f1v-repo/telemetry:latest-prod"
}
