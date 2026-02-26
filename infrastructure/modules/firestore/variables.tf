variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (dev, uat, prod)"
  type        = string
}

variable "location_id" {
  description = "The region/location for the Firestore Database (e.g., us-central1)"
  type        = string
}

variable "database_name" {
  description = "The name of the Firestore database"
  type        = string
  default     = "(default)" # The default DB instance
}

variable "delete_protection" {
  description = "Whether to enable delete protection"
  type        = string
  default     = "DELETE_PROTECTION_DISABLED" # Safer for Dev/UAT iterating
}