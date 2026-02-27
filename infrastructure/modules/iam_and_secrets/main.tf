# ==============================================================================
# 1. SERVICE ACCOUNTS
# ==============================================================================

# CI/CD Cloud Build
resource "google_service_account" "cloudbuild" {
  account_id   = "sa-f1v-cloudbuild-${var.environment}"
  display_name = "F1V Cloud Build CI/CD Service Account (${var.environment})"
}

# Data Ingestion (OpenF1 -> Pub/Sub & BigQuery)
resource "google_service_account" "data_ingestion" {
  account_id   = "sa-f1v-data-ingestion-${var.environment}"
  display_name = "F1V Data Ingestion Service Account (${var.environment})"
}

# Telemetry Broker (Pub/Sub -> WebSockets)
resource "google_service_account" "telemetry" {
  account_id   = "sa-f1v-telemetry-${var.environment}"
  display_name = "F1V Telemetry Broker Service Account (${var.environment})"
}

# Data Analysis (BigQuery -> REST API)
resource "google_service_account" "data_analysis" {
  account_id   = "sa-f1v-data-analysis-${var.environment}"
  display_name = "F1V Data Analysis Service Account (${var.environment})"
}

# User Management (Firestore CRUD)
resource "google_service_account" "user" {
  account_id   = "sa-f1v-user-${var.environment}"
  display_name = "F1V User Management Service Account (${var.environment})"
}

# Frontend Webapp (Isolated)
resource "google_service_account" "frontend" {
  account_id   = "sa-f1v-frontend-${var.environment}"
  display_name = "F1V Frontend Isolated Service Account (${var.environment})"
}

# ==============================================================================
# 2. IAM ROLE BINDINGS (Principle of Least Privilege)
# ==============================================================================

# -- Cloud Build Roles --
resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_builder_permissions" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

# -- Ingestion Roles --
resource "google_project_iam_member" "data_ingestion_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}
resource "google_project_iam_member" "data_ingestion_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}
resource "google_project_iam_member" "data_ingestion_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}

# -- Telemetry Roles --
resource "google_project_iam_member" "telemetry_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.telemetry.email}"
}

# -- Analysis Roles --
resource "google_project_iam_member" "data_analysis_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.data_analysis.email}"
}

# -- User Roles --
resource "google_project_iam_member" "user_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.user.email}"
}

# (Note: Frontend gets ZERO bindings, effectively isolating it completely)

# -- API Gateway: Allow Cloud Build to Create/Update Gateways & Configs --
resource "google_project_iam_member" "cloudbuild_apigateway_admin" {
  project = var.project_id
  role    = "roles/apigateway.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

# -- Cloud Run: Ensure it can "Describe" services to get URLs --
# (It likely has this, but let's be explicit to avoid the next error)
resource "google_project_iam_member" "cloudbuild_run_viewer" {
  project = var.project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}