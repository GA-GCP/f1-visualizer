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


