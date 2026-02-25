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