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
