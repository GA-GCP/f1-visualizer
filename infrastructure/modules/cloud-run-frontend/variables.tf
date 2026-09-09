variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}
variable "region" {
  description = "GCP Region"
  type        = string
}
variable "service_name" {
  description = "GCP CloudRun service name"
  type        = string
}

# SEC-2: required, with no default. The backend module defaults this to null with
# a comment saying Terragrunt will enforce it; nothing did, and the frontend
# module did not read it at all, so the internet-facing nginx container ran as
# <project-number>-compute@developer.gserviceaccount.com — which carries
# roles/editor unless iam.automaticIamGrantsForDefaultServiceAccounts is
# enforced. The SPA had more privilege than any backend service.
variable "service_account_email" {
  description = "Identity the service runs as. Required: leaving it unset silently falls back to the default compute service account."
  type        = string

  validation {
    condition     = can(regex("^[^@]+@[^@]+\\.iam\\.gserviceaccount\\.com$", var.service_account_email))
    error_message = "service_account_email must be a service account email, not the default compute account."
  }
}
variable "image_url" {
  description = "Docker image URL (e.g., us-central1-docker.pkg.dev/...)"
  type        = string
}
variable "is_public" {
  description = "Whether to allow unauthenticated invocations"
  type        = bool
  default     = true # Frontend is always public-facing
}
variable "deletion_protection" {
  description = "Prevent the service from being destroyed"
  type        = bool
  default     = false
}
variable "min_instance_count" {
  description = "Minimum number of instances to keep warm (0 = scale to zero)"
  type        = number
  default     = 0
}
variable "max_instance_count" {
  description = "Maximum number of instances to scale up to"
  type        = number
  default     = 3 # Lower than backend — static SPA serving needs fewer instances
}
