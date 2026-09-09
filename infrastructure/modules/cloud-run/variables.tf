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
# PERF-1: replaced vpc_connector_id. Both must be set, or neither — a service
# with no private dependency (user, analysis) attaches to no network at all.
variable "vpc_network" {
  description = "VPC network name for direct egress. Null for services with no private dependency."
  type        = string
  default     = null
}

variable "vpc_subnetwork" {
  description = "Subnet name the instance takes an address on. Required when vpc_network is set."
  type        = string
  default     = null
}
variable "env_vars" {
  description = "Environment variables (Key=Value)"
  type        = map(string)
  default     = {}
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
# CPLX-4 / SEC-2: this defaulted to null with the comment "we will enforce it in
# Terragrunt". Nothing did, and the frontend module — which did not read the
# variable at all — ran as the default compute service account for as long as it
# existed. Required, with no default.
variable "service_account_email" {
  description = "Identity the service runs as. Required: leaving it unset falls back to the default compute service account."
  type        = string

  validation {
    condition     = can(regex("^[^@]+@[^@]+\\.iam\\.gserviceaccount\\.com$", var.service_account_email))
    error_message = "service_account_email must be a service account email, not the default compute account."
  }
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

# CPLX-4: the description named INGRESS_TRAFFIC_INTERNAL_AND_CLOUD_LOAD_BALANCING,
# which is not a valid value for the v2 API — the validation below rejects it —
# and the default was the most open of the three. A service that has to be
# reachable from the internet now says so.
variable "ingress" {
  description = "Which callers may reach the service directly. INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER keeps the *.run.app URL from answering the internet."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  validation {
    condition = contains([
      "INGRESS_TRAFFIC_ALL",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    ], var.ingress)
    error_message = "ingress must be one of INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER."
  }
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

variable "invokers" {
  description = "Members granted roles/run.invoker. Accepts \"allUsers\" for a service fronted by a serverless NEG, which cannot present an ID token."
  type        = list(string)
  default     = []
}

variable "container_port" {
  description = "Port the container listens on. 8080 for the Spring services; nginx.conf also listens on 8080."
  type        = number
  default     = 8080
}

# CPLX-4: objects rather than eight flat variables, and defaulted to the JVM
# services' values so only the frontend states anything.
variable "startup_probe" {
  description = "Startup probe. The default is Actuator's readiness group with a 150s budget, which is generous for a JVM cold start with CPU boost."
  type = object({
    path                  = optional(string, "/actuator/health/readiness")
    initial_delay_seconds = optional(number, 10)
    period_seconds        = optional(number, 5)
    timeout_seconds       = optional(number, 5)
    failure_threshold     = optional(number, 30)
  })
  default = {}
}

variable "liveness_probe" {
  description = "Liveness probe. Restarts an instance that is alive as a process but no longer serving."
  type = object({
    path                  = optional(string, "/actuator/health/liveness")
    initial_delay_seconds = optional(number, 30)
    period_seconds        = optional(number, 30)
    timeout_seconds       = optional(number, 5)
    failure_threshold     = optional(number, 3)
  })
  default = {}
}
