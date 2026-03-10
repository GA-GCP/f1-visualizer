# ==========================================
# Cloud Build Triggers with Path Filters
# ==========================================
# Each trigger is scoped to specific file paths so that only
# the affected pipelines run when code changes are pushed.
# ==========================================

# --- Backend Service Triggers ---

resource "google_cloudbuild_trigger" "backend_data_analysis" {
  name        = "f1v-backend-data-analysis-${var.environment}"
  description = "Builds and deploys the data-analysis service on push to main"
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
    "backend/f1v-service-data-analysis/**",
    "backend/f1v-commons-bom/**",
    "backend/f1v-commons-parent/**",
    "backend/pom.xml",
    "backend/Dockerfile.ci",
    "cloudbuild/backend-data-analysis.yaml",
  ]

  filename = "cloudbuild/backend-data-analysis.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_cloudbuild_trigger" "backend_data_ingestion" {
  name        = "f1v-backend-data-ingestion-${var.environment}"
  description = "Builds and deploys the data-ingestion service on push to main"
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
    "backend/f1v-service-data-ingestion/**",
    "backend/f1v-commons-bom/**",
    "backend/f1v-commons-parent/**",
    "backend/pom.xml",
    "backend/Dockerfile.ci",
    "cloudbuild/backend-data-ingestion.yaml",
  ]

  filename = "cloudbuild/backend-data-ingestion.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_cloudbuild_trigger" "backend_telemetry" {
  name        = "f1v-backend-telemetry-${var.environment}"
  description = "Builds and deploys the telemetry service on push to main"
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
    "backend/f1v-service-telemetry/**",
    "backend/f1v-commons-bom/**",
    "backend/f1v-commons-parent/**",
    "backend/pom.xml",
    "backend/Dockerfile.ci",
    "cloudbuild/backend-telemetry.yaml",
  ]

  filename = "cloudbuild/backend-telemetry.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_cloudbuild_trigger" "backend_user" {
  name        = "f1v-backend-user-${var.environment}"
  description = "Builds and deploys the user service on push to main"
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
    "backend/f1v-service-user/**",
    "backend/f1v-commons-bom/**",
    "backend/f1v-commons-parent/**",
    "backend/pom.xml",
    "backend/Dockerfile.ci",
    "cloudbuild/backend-user.yaml",
  ]

  filename = "cloudbuild/backend-user.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
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

# --- API Gateway Trigger ---

resource "google_cloudbuild_trigger" "api_gateway" {
  name        = "f1v-api-gateway-${var.environment}"
  description = "Deploys the API Gateway configuration on push to main"
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
    "infrastructure/openapi.yaml",
    "infrastructure/modules/**",
    "cloudbuild/api-gateway.yaml",
  ]

  filename = "cloudbuild/api-gateway.yaml"

  substitutions = {
    _ENV            = var.environment
    _SHORT_SHA      = "$SHORT_SHA"
    _REGION         = var.region
    _AUTH0_ISSUER   = var.auth0_issuer
    _AUTH0_AUDIENCE = var.auth0_audience
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

  # Exclude openapi.yaml — handled by the API Gateway trigger
  ignored_files = [
    "infrastructure/openapi.yaml",
  ]

  filename = "cloudbuild/infrastructure.yaml"

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/sa-f1v-cloudbuild-${var.environment}@${var.project_id}.iam.gserviceaccount.com"
}
