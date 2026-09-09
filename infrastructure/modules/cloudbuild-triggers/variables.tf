variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for Cloud Build triggers"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, uat, prod)"
  type        = string
}

variable "github_owner" {
  description = "GitHub repository owner (user or organization)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "branch_pattern" {
  description = "Regex pattern for branch to trigger on"
  type        = string
  default     = "^main$"
}



# REL-6: this used to be assembled from project_id and environment inside the
# module, so the triggers unit had no `dependency` on iam-and-secrets and
# Terragrunt could apply it before the account existed. Passing the real output
# makes the edge visible in the dependency graph.
variable "cloudbuild_service_account_email" {
  description = "Email of the service account each trigger runs as"
  type        = string
}
