# ==============================================================================
# 1. RUNTIME SERVICE ACCOUNTS
# ==============================================================================
# One identity per service, so a Cloud Run revision can only do what that service
# is supposed to do.

# Data Ingestion (OpenF1 -> BigQuery, commands onto a Redis stream)
resource "google_service_account" "data_ingestion" {
  account_id   = "sa-f1v-data-ingestion-${var.environment}"
  display_name = "F1V Data Ingestion Service Account (${var.environment})"
}

# Replay Worker (BigQuery -> Redis, the always-on stateful half of ingestion)
resource "google_service_account" "replay_worker" {
  account_id   = "sa-f1v-replay-worker-${var.environment}"
  display_name = "F1V Replay Worker Service Account (${var.environment})"
}

# Telemetry Broker (Redis pub/sub -> WebSockets)
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

# Frontend Webapp. Holds no bindings anywhere, by design — nginx serves static
# files and calls no Google API. SEC-2 is what made that isolation real; until
# then the service ran as the default compute account instead.
resource "google_service_account" "frontend" {
  account_id   = "sa-f1v-frontend-${var.environment}"
  display_name = "F1V Frontend Isolated Service Account (${var.environment})"
}

locals {
  # Every identity a Cloud Run service runs as. Deploying a service means acting
  # as its identity, so both CI accounts need serviceAccountUser on each of
  # these — and on nothing else.
  runtime_service_accounts = {
    data_ingestion = google_service_account.data_ingestion.name
    replay_worker  = google_service_account.replay_worker.name
    telemetry      = google_service_account.telemetry.name
    data_analysis  = google_service_account.data_analysis.name
    user           = google_service_account.user.name
    frontend       = google_service_account.frontend.name
  }
}

# ==============================================================================
# 2. CI SERVICE ACCOUNTS
# ==============================================================================
# SEC-1: there was one account, sa-f1v-cloudbuild-<env>, and it was the
# service_account of all eight triggers. It held, at project level,
# resourcemanager.projectIamAdmin, iam.serviceAccountUser, run.admin,
# bigquery.admin, datastore.owner, redis.admin, compute.networkAdmin,
# compute.loadBalancerAdmin, vpcaccess.admin, apigateway.admin,
# artifactregistry.writer and cloudbuild.builds.builder.
#
# The backend and frontend pipelines run third-party code on every push —
# `./mvnw verify` and `yarn install` with lifecycle scripts. A single malicious
# dependency in a *dev* build could take the metadata-server token, grant itself
# roles/owner, read every secret, and reach prod Firestore, Redis and BigQuery,
# because all three environments share one project. That was the widest blast
# radius in the estate and it was reachable from the least-trusted code path.
#
# Two accounts now. The one that runs untrusted code cannot change IAM at all.

# Runs cloudbuild/backend-service.yaml and cloudbuild/frontend.yaml.
resource "google_service_account" "deploy" {
  account_id   = "sa-f1v-deploy-${var.environment}"
  display_name = "F1V Application Deploy Service Account (${var.environment})"
  description  = "Builds and deploys application images. Runs untrusted third-party build code; holds no IAM, network or data administration."
}

# Runs cloudbuild/infrastructure.yaml, and nothing else.
resource "google_service_account" "infra" {
  account_id   = "sa-f1v-infra-${var.environment}"
  display_name = "F1V Infrastructure Pipeline Service Account (${var.environment})"
  description  = "Runs terragrunt plan/apply. Executes only code from this repository."
}

# ==============================================================================
# 3. DEPLOY IDENTITY — build an image, roll a revision, and nothing else
# ==============================================================================

# run.developer, not run.admin: it can create revisions and shift traffic on
# existing services, but cannot change a service's IAM policy — which is what
# would let it make a private service public.
resource "google_project_iam_member" "deploy_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Reads service URLs and the traffic list, which the frontend smoke test needs.
resource "google_project_iam_member" "deploy_run_viewer" {
  project = var.project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# SEC-8: cloudbuild.builds.builder is the broad legacy role, and it was granted
# even though the triggers use a user-specified service account with
# CLOUD_LOGGING_ONLY. logging.logWriter is the documented minimum for that
# combination.
resource "google_project_iam_member" "deploy_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploying a service means acting as that service's identity. Granted per
# account rather than as a project-level roles/iam.serviceAccountUser, which
# Trivy flags as GCP-0011 and which would cover every service account in the
# project — including the two CI accounts themselves.
resource "google_service_account_iam_member" "deploy_acts_as_runtime" {
  for_each = local.runtime_service_accounts

  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# ==============================================================================
# 4. INFRASTRUCTURE IDENTITY
# ==============================================================================

locals {
  # REL-4: the pipeline could not manage several resources the code declares.
  # compute.networkAdmin is defined by Google as network administration "except
  # for firewall rules and SSL certificates", and the networking module creates
  # two firewall rules; nothing covered creating Secret Manager secrets (redis
  # module), service accounts (this module), the Artifact Registry repository
  # (artifactregistry.writer cannot create repositories) or Cloud Build triggers.
  # It worked only because a human with Owner had already created them, and the
  # first drift in any of those would have failed a prod apply mid-run.
  infra_project_roles = [
    "roles/run.admin",                 # creates and configures services, and their IAM
    "roles/iam.serviceAccountAdmin",   # REL-4: the service accounts above
    "roles/compute.networkAdmin",      # VPC, subnet, addresses, NEGs
    "roles/compute.securityAdmin",     # REL-4: firewall rules, SSL policies
    "roles/compute.loadBalancerAdmin", # backend services, URL maps, proxies
    "roles/vpcaccess.admin",           # serverless VPC access
    "roles/redis.admin",               # Memorystore
    "roles/bigquery.admin",            # dataset and tables
    "roles/datastore.owner",           # Firestore databases and indexes
    "roles/secretmanager.admin",       # REL-4: the Redis AUTH secret
    "roles/artifactregistry.admin",    # REL-4: the repository itself
    "roles/cloudbuild.builds.editor",  # REL-4: the triggers
    "roles/monitoring.editor",         # OPS-1: alert policies, uptime checks
    "roles/logging.logWriter",         # its own build logs
  ]

  # Every role this repository grants at project level. Used below to bound what
  # the infrastructure identity is allowed to hand out.
  grantable_project_roles = concat(local.infra_project_roles, [
    "roles/resourcemanager.projectIamAdmin",
    "roles/run.developer",
    "roles/run.viewer",
    "roles/artifactregistry.writer",
    "roles/bigquery.jobUser",
    "roles/bigquery.dataEditor",
    "roles/bigquery.dataViewer",
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountUser",
  ])
}

resource "google_project_iam_member" "infra_roles" {
  for_each = toset(local.infra_project_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.infra.email}"
}

# SEC-1: this module declares google_project_iam_member resources, so whatever
# applies it must be able to change project IAM. Unconditional projectIamAdmin
# means it can grant itself roles/owner, which is the escalation this finding is
# about.
#
# The condition is a delegated role grant: modifiedGrantsByRole restricts which
# roles this account may add or remove, and the allow-list is exactly the set
# this repository grants. roles/owner, roles/editor and
# roles/iam.serviceAccountKeyAdmin are not on it and cannot be granted.
resource "google_project_iam_member" "infra_project_iam_admin" {
  project = var.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.infra.email}"

  condition {
    title       = "grant-only-roles-this-repo-declares"
    description = "Limits delegated grants to the roles declared in infrastructure/modules/iam-and-secrets. Blocks owner, editor and key admin."
    expression  = "api.getAttribute('iam.googleapis.com/modifiedGrantsByRole', []).hasOnly([${join(", ", formatlist("'%s'", local.grantable_project_roles))}])"
  }
}

# Creating a Cloud Run service that runs as an identity means acting as it.
resource "google_service_account_iam_member" "infra_acts_as_runtime" {
  for_each = local.runtime_service_accounts

  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.infra.email}"
}

# ==============================================================================
# 5. RUNTIME ROLE BINDINGS (Principle of Least Privilege)
# ==============================================================================
# SEC-8: roles/pubsub.publisher on ingestion and roles/pubsub.subscriber on
# telemetry are gone. No module depends on Pub/Sub; messaging has been Redis
# pub/sub and Redis streams since f1v-commons-messaging replaced it. An unused
# grant is permanent attack surface and makes the policy unreadable as a
# statement of intent.

# -- Ingestion --
resource "google_project_iam_member" "data_ingestion_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
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

# -- Replay Worker --
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

# -- Telemetry --
# Needed to read the Memorystore AUTH string that Cloud Run mounts as
# SPRING_DATA_REDIS_PASSWORD (S2).
resource "google_project_iam_member" "telemetry_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.telemetry.email}"
}

# -- Analysis --
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

# -- User --
resource "google_project_iam_member" "user_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.user.email}"
}
