variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "environment" {
  description = "Environment (dev, uat, prod)"
  type        = string
}

variable "network_id" {
  description = "The VPC Network ID to connect Redis to"
  type        = string
}
# REL-12: the tier used to be `var.environment == "prod" ? "STANDARD_HA" :
# "BASIC"`, while environments/prod/redis passed a `tier` input that no variable
# declared — so Terragrunt exported TF_VAR_tier and OpenTofu silently ignored it.
# A reader of the prod unit reasonably believed that line was what produced HA.
# Renaming the environment, or adding a `staging`, would have quietly produced a
# BASIC instance in production.
variable "tier" {
  description = "Memorystore service tier. STANDARD_HA gives a replica and automatic failover; BASIC is a single node with no failover."
  type        = string
  default     = "BASIC"

  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.tier)
    error_message = "tier must be BASIC or STANDARD_HA."
  }
}

variable "memory_size_gb" {
  description = "Instance capacity in GiB. The live feed and replay buffers are the working set; this is not a durable store."
  type        = number
  default     = 1

  validation {
    condition     = var.memory_size_gb >= 1 && var.memory_size_gb <= 300
    error_message = "memory_size_gb must be between 1 and 300."
  }
}
