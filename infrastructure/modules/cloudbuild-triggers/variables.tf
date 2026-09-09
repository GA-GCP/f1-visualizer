variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for Cloud Build triggers"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, uat, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "uat", "prod"], var.environment)
    error_message = "environment must be dev, uat or prod."
  }
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
  description = "Regex the pushed branch must match. One branch per environment: ^dev$, ^uat$, ^prod$."
  type        = string
  default     = "^main$"

  validation {
    condition     = can(regex("^\\^.*\\$$", var.branch_pattern))
    error_message = "branch_pattern must be anchored with ^ and $, or it will match branches it was not meant to."
  }
}



# REL-6: these used to be one email assembled from project_id and environment
# inside the module, so the triggers unit had no `dependency` on iam-and-secrets
# and Terragrunt could apply it before the account existed. SEC-1 then split the
# one account in two.
variable "deploy_service_account_email" {
  description = "Identity the backend and frontend triggers run as. Runs third-party build code; holds no IAM or network administration."
  type        = string
}

variable "infra_service_account_email" {
  description = "Identity the infrastructure trigger runs as. Runs only code from this repository."
  type        = string
}

variable "cloudbuild_repository_id" {
  description = "2nd-gen google_cloudbuildv2_repository id. Empty keeps the 1st-gen github block, whose connection is console state (CPLX-8)."
  type        = string
  default     = ""
}
