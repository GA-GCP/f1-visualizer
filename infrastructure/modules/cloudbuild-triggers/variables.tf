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

variable "auth0_issuer" {
  description = "Auth0 issuer URI for the API Gateway (e.g., https://dev-xxx.us.auth0.com)"
  type        = string
}

variable "auth0_audience" {
  description = "Auth0 audience identifier for the API Gateway"
  type        = string
}
