variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (dev, uat, prod)"
  type        = string
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
