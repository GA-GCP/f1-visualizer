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
  description = "Whether to allow unauthenticated invocations"
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
variable "min_instance_count" {
  description = "Minimum number of instances to keep warm (0 = scale to zero, 1+ = always-on)"
  type        = number
  default     = 0
}
variable "max_instance_count" {
  description = "Maximum number of instances to scale up to"
  type        = number
  default     = 5
}
variable "cpu" {
  description = "CPU limit for the Cloud Run container (e.g., '1000m' = 1 vCPU, '2000m' = 2 vCPUs)"
  type        = string
  default     = "1000m"
}
variable "memory" {
  description = "Memory limit for the Cloud Run container (e.g., '512Mi', '1024Mi', '2Gi')"
  type        = string
  default     = "512Mi"
}
variable "timeout" {
  description = "Maximum request duration (e.g., '300s', '3600s'). Defaults to Cloud Run's 300s."
  type        = string
  default     = null
}

variable "cpu_idle" {
  description = "true = CPU is throttled between requests (Cloud Run's default). Set false for services that do work off the request thread — the replay tick, MQTT callbacks, the Redis subscriber."
  type        = bool
  default     = true
}
variable "secret_env_vars" {
  description = <<-EOT
    Environment variables sourced from Secret Manager, as env var name => { secret, version }.
    The service account needs roles/secretmanager.secretAccessor on each secret.
    `version` defaults to "latest"; pin it for credentials that should only change
    through a deliberate deploy, and leave it on "latest" for values GCP rotates
    for us (the Memorystore AUTH string).
  EOT
  type = map(object({
    secret  = string
    version = optional(string, "latest")
  }))
  default = {}
}

variable "ingress" {
  description = "Which callers may reach the service directly. INGRESS_TRAFFIC_INTERNAL_AND_CLOUD_LOAD_BALANCING keeps the *.run.app URL from answering the internet."
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"

  validation {
    condition = contains([
      "INGRESS_TRAFFIC_ALL",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    ], var.ingress)
    error_message = "ingress must be one of INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER."
  }
}
variable "invoker_service_accounts" {
  description = "Service account emails granted roles/run.invoker. Used to give the API Gateway private access once allUsers is removed."
  type        = list(string)
  default     = []
}
