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

# Replay Worker (BigQuery -> Redis, the always-on stateful half of ingestion)
resource "google_service_account" "replay_worker" {
  account_id   = "sa-f1v-replay-worker-${var.environment}"
  display_name = "F1V Replay Worker Service Account (${var.environment})"
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

# API Gateway (mints ID tokens for the private Cloud Run backends)
resource "google_service_account" "gateway" {
  account_id   = "sa-f1v-gateway-${var.environment}"
  display_name = "F1V API Gateway Backend Auth Service Account (${var.environment})"
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
resource "google_project_iam_member" "data_ingestion_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}

# R3: ingestion job status lives in Firestore so it survives the deploy that
# restarts the service mid-load.
resource "google_project_iam_member" "data_ingestion_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}

# -- Replay Worker Roles --
# R1: reads the telemetry and locations it replays, and needs the OpenF1
# credentials for the MQTT bridge and the Redis AUTH string.
resource "google_project_iam_member" "replay_worker_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.replay_worker.email}"
}
resource "google_project_iam_member" "replay_worker_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.replay_worker.email}"
}
resource "google_project_iam_member" "replay_worker_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.replay_worker.email}"
}

# -- Telemetry Roles --
# Needed to read the Memorystore AUTH string that Cloud Run mounts as
# SPRING_DATA_REDIS_PASSWORD (S2). Ingestion already holds this role.
resource "google_project_iam_member" "telemetry_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.telemetry.email}"
}
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
resource "google_project_iam_member" "data_analysis_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.data_analysis.email}"
}
resource "google_project_iam_member" "data_analysis_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
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
resource "google_project_iam_member" "cloudbuild_run_viewer" {
  project = var.project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}

# -- Infrastructure Pipeline: Manage all IaC-provisioned resources --
# These roles enable the Cloud Build SA to run terragrunt plan/apply
# across all modules (networking, BigQuery, Firestore, Redis, LBs, IAM).
resource "google_project_iam_member" "cloudbuild_project_iam_admin" {
  project = var.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_compute_network_admin" {
  project = var.project_id
  role    = "roles/compute.networkAdmin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_vpcaccess_admin" {
  project = var.project_id
  role    = "roles/vpcaccess.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_lb_admin" {
  project = var.project_id
  role    = "roles/compute.loadBalancerAdmin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_bq_admin" {
  project = var.project_id
  role    = "roles/bigquery.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_datastore_owner" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
resource "google_project_iam_member" "cloudbuild_redis_admin" {
  project = var.project_id
  role    = "roles/redis.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}