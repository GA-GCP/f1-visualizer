resource "google_artifact_registry_repository" "repo" {
  location      = var.location
  repository_id = var.repository_id
  description   = "Docker repository for F1 Visualizer (${var.environment})"
  format        = "DOCKER"
  project       = var.project_id

  labels = {
    env = var.environment
  }
}
# SEC-1: roles/artifactregistry.writer used to be a project-level grant on the
# one CI identity, so a build could push to every repository in the project. The
# deploy identity needs to push to exactly one.
resource "google_artifact_registry_repository_iam_member" "writers" {
  for_each = toset(var.writer_members)

  project    = var.project_id
  location   = google_artifact_registry_repository.repo.location
  repository = google_artifact_registry_repository.repo.name
  role       = "roles/artifactregistry.writer"
  member     = each.value
}
