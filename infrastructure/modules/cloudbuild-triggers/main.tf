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

  # CPLX-8: the first generation names the repository and relies on a connection
  # created by hand in the console. The second makes that connection a resource,
  # declared in infrastructure/platform. Both are here so the cutover is a value
  # rather than a rewrite of seven triggers.
  dynamic "github" {
    for_each = var.cloudbuild_repository_id == "" ? [1] : []
    content {
      owner = var.github_owner
      name  = var.github_repo

      push {
        branch = var.branch_pattern
      }
    }
  }

  dynamic "repository_event_config" {
    for_each = var.cloudbuild_repository_id == "" ? [] : [1]
    content {
      repository = var.cloudbuild_repository_id

      push {
        branch = var.branch_pattern
      }
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

  service_account = "projects/${var.project_id}/serviceAccounts/${var.deploy_service_account_email}"
}

# --- Frontend Trigger ---

resource "google_cloudbuild_trigger" "frontend" {
  name        = "f1v-frontend-${var.environment}"
  description = "Builds and deploys the frontend webapp on push to main"
  project     = var.project_id
  location    = var.region

  # CPLX-8: the first generation names the repository and relies on a connection
  # created by hand in the console. The second makes that connection a resource,
  # declared in infrastructure/platform. Both are here so the cutover is a value
  # rather than a rewrite of seven triggers.
  dynamic "github" {
    for_each = var.cloudbuild_repository_id == "" ? [1] : []
    content {
      owner = var.github_owner
      name  = var.github_repo

      push {
        branch = var.branch_pattern
      }
    }
  }

  dynamic "repository_event_config" {
    for_each = var.cloudbuild_repository_id == "" ? [] : [1]
    content {
      repository = var.cloudbuild_repository_id

      push {
        branch = var.branch_pattern
      }
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

  service_account = "projects/${var.project_id}/serviceAccounts/${var.deploy_service_account_email}"
}

# --- Infrastructure Trigger ---

resource "google_cloudbuild_trigger" "infrastructure" {
  name        = "f1v-infrastructure-${var.environment}"
  description = "Plans and applies infrastructure changes on push to main"
  project     = var.project_id
  location    = var.region

  # CPLX-8: the first generation names the repository and relies on a connection
  # created by hand in the console. The second makes that connection a resource,
  # declared in infrastructure/platform. Both are here so the cutover is a value
  # rather than a rewrite of seven triggers.
  dynamic "github" {
    for_each = var.cloudbuild_repository_id == "" ? [1] : []
    content {
      owner = var.github_owner
      name  = var.github_repo

      push {
        branch = var.branch_pattern
      }
    }
  }

  dynamic "repository_event_config" {
    for_each = var.cloudbuild_repository_id == "" ? [] : [1]
    content {
      repository = var.cloudbuild_repository_id

      push {
        branch = var.branch_pattern
      }
    }
  }

  included_files = [
    "infrastructure/**",
  ]

  filename = "cloudbuild/infrastructure.yaml"

  # REL-5: a merge to `prod` touching any file under infrastructure/ used to
  # apply within minutes with nobody looking at the plan — including destroys —
  # while the README's branch table said prod "requires approval". The plan runs
  # either way; this holds the apply until a human has read it.
  #
  # Deliberately not on the backend and frontend triggers. The frontend pipeline
  # already gates itself: it deploys with no traffic, smoke tests the revision on
  # its own tag URL and only then promotes. A backend deploy is reversible by
  # re-running the pipeline at an earlier SHA. Neither can destroy a Redis
  # instance or a VPC, which is what this gate is actually for.
  approval_config {
    approval_required = var.environment == "prod"
  }

  substitutions = {
    _ENV       = var.environment
    _SHORT_SHA = "$SHORT_SHA"
    _REGION    = var.region
  }

  # SEC-1: the only trigger that runs the infrastructure identity. Everything
  # else here executes third-party build code and must not be able to change IAM.
  service_account = "projects/${var.project_id}/serviceAccounts/${var.infra_service_account_email}"
}
