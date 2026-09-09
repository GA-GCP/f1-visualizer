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

variable "dataset_id" {
  description = "BigQuery dataset id. Per environment: the services read it from F1V_BIGQUERY_DATASET."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_]+$", var.dataset_id))
    error_message = "dataset_id may contain only letters, numbers and underscores."
  }
}

variable "location" {
  description = "The location for the BigQuery Dataset"
  type        = string
  default     = "US"
}
variable "dataset_editors" {
  description = "Members granted roles/bigquery.dataEditor on this dataset, as fully-qualified IAM members."
  type        = list(string)
  default     = []
}

variable "dataset_viewers" {
  description = "Members granted roles/bigquery.dataViewer on this dataset, as fully-qualified IAM members."
  type        = list(string)
  default     = []
}

variable "max_time_travel_hours" {
  description = "Time travel window. The default is 168 (seven days); these tables only grow by append, so two days covers the recovery they need."
  type        = number
  default     = 48

  validation {
    condition     = var.max_time_travel_hours >= 48 && var.max_time_travel_hours <= 168
    error_message = "max_time_travel_hours must be between 48 and 168."
  }
}

variable "storage_billing_model" {
  description = "LOGICAL bills uncompressed size, PHYSICAL bills what is stored. PHYSICAL is a 14-day commitment; measure the ratio first (see main.tf)."
  type        = string
  default     = "LOGICAL"

  validation {
    condition     = contains(["LOGICAL", "PHYSICAL"], var.storage_billing_model)
    error_message = "storage_billing_model must be LOGICAL or PHYSICAL."
  }
}
