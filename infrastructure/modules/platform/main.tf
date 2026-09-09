# ==============================================================================
# Platform layer
# ==============================================================================
# CPLX-2: resources shared by every environment used to live inside
# environments/dev — the Artifact Registry repository prod pulls from, and the
# BigQuery dataset all three read and write. A newcomer could not tell from the
# tree which resources were per-environment, and `run --all destroy` in dev would
# have taken production's images with it (REL-8).
#
# OPS-3: the project-level plumbing every module depends on was console state, so
# a new project could not be stood up from this repository at all.

# ==============================================================================
# 1. PROJECT SERVICES (OPS-3)
# ==============================================================================
# Nothing enabled these. The bootstrap order in infrastructure/README.md had to
# list them by hand because the repository did not.
resource "google_project_service" "apis" {
  for_each = toset(var.enabled_apis)

  project = var.project_id
  service = each.value

  # Disabling an API on destroy takes every resource that uses it with it, which
  # is never what a `terragrunt destroy` of this unit is meant to do.
  disable_on_destroy = false
}

# ==============================================================================
# 2. TERRAFORM STATE BUCKET (SEC-7)
# ==============================================================================
# The bucket root.hcl writes every unit's state into was created outside IaC, so
# its versioning, uniform bucket-level access, public-access prevention and IAM
# were unknown from the repository. `google_redis_instance.auth_string` and the
# secret version both land in that state in clear text, so anyone with
# storage.objects.get on it could read the Redis credential for every
# environment — and without versioning, a corrupted or force-pushed state could
# not be recovered.
#
# This resource describes the bucket it is stored in. Import it once; see
# infrastructure/README.md.
resource "google_storage_bucket" "tfstate" {
  name     = var.state_bucket
  project  = var.project_id
  location = var.state_bucket_location

  # Recovery from a corrupted or truncated state file.
  versioning {
    enabled = true
  }

  # No per-object ACLs: access is IAM, and readable as one policy.
  uniform_bucket_level_access = true

  # A state bucket can never be legitimately public.
  public_access_prevention = "enforced"

  # A week to notice a deletion and undo it.
  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  # Old state generations are the recovery mechanism, not an archive.
  lifecycle_rule {
    condition {
      num_newer_versions = 20
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ==============================================================================
# 3. ARTIFACT REGISTRY (CPLX-2, OPS-4)
# ==============================================================================
resource "google_artifact_registry_repository" "repo" {
  for_each = var.registries

  project       = var.project_id
  location      = each.value.location
  repository_id = var.repository_id
  description   = "Docker repository for F1 Visualizer (${each.key})"
  format        = "DOCKER"

  labels = {
    app        = "f1v"
    managed_by = "terragrunt"
  }

  # OPS-4: every build pushed a new SHA tag and re-pointed a floating one, and
  # nothing ever deleted anything.
  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 20
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s" # 30 days
    }
  }

  # OPS-4: an immutable tag cannot be re-pointed after it was scanned and
  # deployed. REL-1 is what made this safe to turn on: IaC no longer resolves a
  # floating tag, so the only mutable tag left is latest-<env>, which the
  # pipeline overwrites deliberately.
  #
  # Off by default because it breaks that overwrite: enabling it means the
  # pipeline must stop pushing latest-<env>, and the --cache-from would have to
  # move to the SHA tag of the previous build.
  docker_config {
    immutable_tags = var.immutable_tags
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_artifact_registry_repository_iam_member" "writers" {
  for_each = {
    for pair in flatten([
      for name, cfg in var.registries : [
        for member in cfg.writer_members : {
          key      = "${name}:${member}"
          registry = name
          member   = member
        }
      ]
    ]) : pair.key => pair
  }

  project    = var.project_id
  location   = google_artifact_registry_repository.repo[each.value.registry].location
  repository = google_artifact_registry_repository.repo[each.value.registry].name
  role       = "roles/artifactregistry.writer"
  member     = each.value.member
}

# ==============================================================================
# 4. SHARED SECRETS (SEC-6, CPLX-2)
# ==============================================================================
# One credential, shared by all three environments, because OpenF1 issues one
# account. Declaring it once here says that plainly; three per-environment units
# declaring the same secret_id said the opposite.
resource "google_secret_manager_secret" "shared" {
  for_each = toset(var.shared_secret_ids)

  secret_id = each.value
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    app        = "f1v"
    managed_by = "terragrunt"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# SEC-3: per secret, for the accounts that consume it.
resource "google_secret_manager_secret_iam_member" "shared_accessors" {
  for_each = {
    for pair in flatten([
      for sid in var.shared_secret_ids : [
        for member in var.shared_secret_accessors : {
          key    = "${sid}:${member}"
          secret = sid
          member = member
        }
      ]
    ]) : pair.key => pair
  }

  project   = var.project_id
  secret_id = google_secret_manager_secret.shared[each.value.secret].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}

# ==============================================================================
# 5. DNS (OPS-3)
# ==============================================================================
# The zone and the six A records the managed certificates depend on were not in
# the repository, which is why the certificates' well-known bootstrap failure —
# stuck in PROVISIONING until DNS points at the address — had no codified answer.
#
# The zone lives here; the records live with the load balancers that own the
# addresses, so an environment's apply is still self-contained.
resource "google_dns_managed_zone" "primary" {
  count = var.dns_zone_name == "" ? 0 : 1

  project     = var.project_id
  name        = var.dns_zone_name
  dns_name    = "${var.dns_domain}."
  description = "F1 Visualizer public zone"

  lifecycle {
    prevent_destroy = true
  }
}

# ==============================================================================
# 6. AUDIT LOGGING AND RETENTION (SEC-9, OPS-3)
# ==============================================================================
# Nothing enabled Data Access audit logs, so a secret read or a Firestore write
# was not in the audit trail at all — which is precisely the evidence SEC-1 and
# SEC-3 would need after the fact.
resource "google_project_iam_audit_config" "data_access" {
  for_each = toset(var.audit_log_services)

  project = var.project_id
  service = each.value

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

# _Default retains for 30 days, which is shorter than most questions worth
# asking about an access.
resource "google_logging_project_bucket_config" "default" {
  project        = var.project_id
  location       = "global"
  bucket_id      = "_Default"
  retention_days = var.log_retention_days
}

# ==============================================================================
# 7. ORG POLICIES (SEC-9)
# ==============================================================================
# Constraints, not settings: these cannot be undone by a project-level change.
#
# automaticIamGrantsForDefaultServiceAccounts is the one that matters most here —
# it is what makes SEC-2's fix permanent rather than a state the next default
# service account drifts out of.
#
# Requires an organization. A standalone project cannot set these, so they are
# behind a flag rather than failing the apply.
resource "google_project_organization_policy" "boolean_constraints" {
  for_each = var.org_policies_enabled ? toset(var.boolean_org_policies) : toset([])

  project    = var.project_id
  constraint = each.value

  boolean_policy {
    enforced = true
  }
}

# ==============================================================================
# 8. WORKLOAD IDENTITY FEDERATION FOR THE PR PLAN (DLV-1)
# ==============================================================================
# Nothing planned before merge: the GitHub job named "Infrastructure Scan & Plan"
# ran `tofu validate` per module and no plan, because Actions had no GCP
# credentials, and the first real plan lived inside the Cloud Build run that
# applied it seconds later. Reviewers approved promotion PRs without ever seeing
# what would change.
#
# Federation rather than a service account key, so there is no secret to leak or
# rotate. The identity below can read; it cannot apply.
resource "google_iam_workload_identity_pool" "github" {
  count = var.github_repository == "" ? 0 : 1

  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "Federated identities for pull-request plans (DLV-1)"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.github_repository == "" ? 0 : 1

  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Without this, any repository on github.com could mint a token for this pool.
  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "planner" {
  count = var.github_repository == "" ? 0 : 1

  project      = var.project_id
  account_id   = "sa-f1v-planner"
  display_name = "F1V Pull-Request Planner"
  description  = "Read-only. Runs terragrunt plan from a pull request; cannot apply."
}

# roles/viewer plus state read is everything a plan needs and nothing an apply
# does. It is deliberately not one of the roles the infrastructure identity may
# grant (see grantable_project_roles in iam-and-secrets) — this account is
# created here, in the layer a human applies.
resource "google_project_iam_member" "planner_viewer" {
  count = var.github_repository == "" ? 0 : 1

  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.planner[0].email}"
}

resource "google_storage_bucket_iam_member" "planner_state_reader" {
  count = var.github_repository == "" ? 0 : 1

  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.planner[0].email}"
}

# Only workflows in the named repository may act as the planner.
resource "google_service_account_iam_member" "planner_federation" {
  count = var.github_repository == "" ? 0 : 1

  service_account_id = google_service_account.planner[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}
