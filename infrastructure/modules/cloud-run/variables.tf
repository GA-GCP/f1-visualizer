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
  type = string
}
variable "image_url" {
  description = "Docker image URL (e.g., us-central1-docker.pkg.dev/...)"
  type        = string
}
variable "vpc_connector_id" {
  description = "VPC Connector ID for Redis access"
  type        = string
  default     = null
}
variable "env_vars" {
  description = "Environment variables (Key=Value)"
  type        = map(string)
  default     = {}
}
variable "is_public" {
  description = "Whether to allow unauthenticated invocations (Frontend only)"
  type        = bool
  default     = false
}
variable "container_concurrency" {
  description = "Max concurrent requests per instance"
  type        = number
  default     = 80
}
variable "deletion_protection" {
  description = "Prevent the service from being destroyed"
  type        = bool
  default     = false # Default to false for DEV/UAT agility
}
variable "service_account_email" {
  description = "The IAM Service Account email that this Cloud Run service will run as"
  type        = string
  default     = null # Optional (but we will enforce it in Terragrunt)
}