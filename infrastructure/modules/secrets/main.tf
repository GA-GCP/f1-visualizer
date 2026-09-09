# ==============================================================================
# Shared application secrets
# ==============================================================================
# SEC-6: the module called iam-and-secrets managed no secrets. These two are
# referenced by six units and were created by hand, so nothing in the repository
# recorded that a fresh environment cannot start without them.
#
# The containers are declared here; the values are not. `secret_data` would put
# the credential in plain text in the state file, which is the SEC-7 problem.
# Versions are added out of band — see infrastructure/README.md.
#
# These are still one credential shared by dev, uat and prod: they carry no
# environment suffix because OpenF1 issues one account, and renaming them would
# mean re-populating three secrets by hand for no change in blast radius that
# per-secret IAM does not already give. Rotation is therefore still global, which
# is a property of the upstream service rather than of this configuration.

resource "google_secret_manager_secret" "openf1_username" {
  secret_id = "f1v-api-openf1-login-user-email"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    app        = "f1v"
    managed_by = "terragrunt"
  }

  # The value is owned by whoever rotates the OpenF1 account, not by an apply.
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret" "openf1_password" {
  secret_id = "f1v-api-openf1-login-user-password"
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

# SEC-3: roles/secretmanager.secretAccessor used to be a project-level binding,
# so sa-f1v-data-ingestion-dev could read f1v-redis-auth-prod. Granted per secret
# to the accounts that consume it — the two services running the MQTT bridge and
# the OpenF1 client.
resource "google_secret_manager_secret_iam_member" "openf1_username_accessors" {
  for_each = toset(var.openf1_accessors)

  project   = var.project_id
  secret_id = google_secret_manager_secret.openf1_username.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value
}

resource "google_secret_manager_secret_iam_member" "openf1_password_accessors" {
  for_each = toset(var.openf1_accessors)

  project   = var.project_id
  secret_id = google_secret_manager_secret.openf1_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value
}
