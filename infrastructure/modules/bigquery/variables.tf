variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (dev, uat, prod)"
  type        = string
}

variable "location" {
  description = "The location for the BigQuery Dataset"
  type        = string
  default     = "US"
}