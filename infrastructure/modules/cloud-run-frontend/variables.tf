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

# PERF-8: neither module stated this, so the platform chose. Services with
# `cpu_idle = false` and work on background threads — the replay tick, the MQTT
# callbacks, the Redis subscriber — are the documented case for gen2, and gen2 is
# also required for direct VPC egress (PERF-1).
variable "execution_environment" {
  description = "Cloud Run execution environment. GEN2 gives a full Linux kernel and is required for direct VPC egress."
  type        = string
  default     = "EXECUTION_ENVIRONMENT_GEN2"

  validation {
    condition     = contains(["EXECUTION_ENVIRONMENT_GEN1", "EXECUTION_ENVIRONMENT_GEN2"], var.execution_environment)
    error_message = "execution_environment must be EXECUTION_ENVIRONMENT_GEN1 or EXECUTION_ENVIRONMENT_GEN2."
  }
}

variable "cpu" {
  description = "CPU limit. nginx serving static files from memory is not CPU bound; the boost covers cold start."
  type        = string
  default     = "1000m"
}

# PERF-8: 512Mi for nginx serving a ~300 kB bundle from disk, and with Cloud CDN
# in front (PERF-2) most requests no longer reach the container at all.
variable "memory" {
  description = "Memory limit for the nginx container"
  type        = string
  default     = "256Mi"
}
