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
variable "point_in_time_recovery" {
  description = "Keep a seven-day point-in-time read window. Costs storage proportional to write volume; off in dev, on in prod."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Retention for the daily backup schedule, in days. Zero creates no schedule. Firestore allows 3 to 14 for daily backups."
  type        = number
  default     = 0

  validation {
    condition     = var.backup_retention_days == 0 || (var.backup_retention_days >= 3 && var.backup_retention_days <= 14)
    error_message = "backup_retention_days must be 0 (no schedule) or between 3 and 14."
  }
}
