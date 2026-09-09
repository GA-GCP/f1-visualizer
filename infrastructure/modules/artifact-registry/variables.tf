variable "project_id" { type = string }
variable "location" { type = string }
variable "repository_id" { type = string }
variable "environment" { type = string }
variable "writer_members" {
  description = "IAM members granted roles/artifactregistry.writer on this repository, as fully-qualified members (e.g. \"serviceAccount:sa-...@...\")."
  type        = list(string)
  default     = []
}
