# ==========================================
# Cloud Build Triggers with Path Filters
# ==========================================
# Each trigger is scoped to specific file paths so that only
# the affected pipelines run when code changes are pushed.
# ==========================================

# --- Backend Service Triggers ---
#
# O3: one resource for five services. There were four copies of this block
# differing in the module path and the pipeline filename, and adding the replay
# worker would have made five.
locals {
  backend_services = {
    data-analysis = {
      module  = "f1v-service-data-analysis"
      image   = "data-analysis"
      service = "f1v-service-data-analysis"
    }
    data-ingestion = {
      module  = "f1v-service-data-ingestion"
      image   = "data-ingestion"
      service = "f1v-service-data-ingestion"
    }
    replay-worker = {
      module  = "f1v-service-replay-worker"
      image   = "replay-worker"
      service = "f1v-service-replay-worker"
    }
    telemetry = {
      module  = "f1v-service-telemetry"
      image   = "telemetry"
      service = "f1v-service-telemetry"
    }
    user = {
      module  = "f1v-service-user"
      image   = "user"
      service = "f1v-service-user"
    }
  }
}

resource "google_cloudbuild_trigger" "backend" {
  for_each = local.backend_services

  name        = "f1v-backend-${each.key}-${var.environment}"
  description = "Builds and deploys the ${each.key} service on push to main"
  project     = var.project_id
  location    = var.region

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.branch_pattern
    }
  }

  # A commons change still rebuilds every service, because it can change any of
  # them. The four commons modules are named explicitly rather than by a
  # wildcard so that adding a fifth is a deliberate edit.
  included_files = [
    "backend/${each.value.module}/**",
    "backend/f1v-commons-web/**",
    "backend/f1v-commons-gcp/**",
    "backend/f1v-commons-messaging/**",
    "backend/f1v-commons-openf1/**",
    "backend/pom.xml",
    "backend/mvnw",
    "backend/.mvn/**",
    "backend/Dockerfile.ci",
    "cloudbuild/backend-service.yaml",
  ]

  filename = "cloudbuild/backend-service.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
    _MODULE    = each.value.module
    _IMAGE     = each.value.image
    _SERVICE   = each.value.service
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}

# --- Frontend Trigger ---

resource "google_cloudbuild_trigger" "frontend" {
  name        = "f1v-frontend-${var.environment}"
  description = "Builds and deploys the frontend webapp on push to main"
  project     = var.project_id
  location    = var.region

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.branch_pattern
    }
  }

  included_files = [
    "frontend/**",
    "cloudbuild/frontend.yaml",
  ]

  filename = "cloudbuild/frontend.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}

# --- Infrastructure Trigger ---

resource "google_cloudbuild_trigger" "infrastructure" {
  name        = "f1v-infrastructure-${var.environment}"
  description = "Plans and applies infrastructure changes on push to main"
  project     = var.project_id
  location    = var.region

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.branch_pattern
    }
  }

  included_files = [
    "infrastructure/**",
  ]

  filename = "cloudbuild/infrastructure.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}
