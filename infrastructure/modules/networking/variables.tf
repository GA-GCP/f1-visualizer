variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (dev, uat, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "uat", "prod"], var.environment)
    error_message = "environment must be dev, uat or prod."
  }
}

variable "region" {
  description = "The GCP region for the subnets"
  type        = string
}

variable "network_name" {
  description = "The name of the VPC network"
  type        = string
}

# PERF-1: connector_cidr is gone with the connector. Each environment has its own
# VPC, so the subnets may — and do — use the same range.
variable "subnet_cidr" {
  description = "IP CIDR range for the subnet Cloud Run attaches to with direct VPC egress"
  type        = string
  default     = "10.0.0.0/24"

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "subnet_cidr must be a valid CIDR range."
  }
}