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

# CPLX-6: `location_id` here, `location` in bigquery and `region` in every other
# module all named the same idea. Standardised on `region`, except in bigquery
# where `location` genuinely differs — a dataset lives in a multi-region ("US"),
# not a region.
variable "region" {
  description = "Region the Firestore database lives in (e.g. us-central1)"
  type        = string
}

variable "database_name" {
  description = "Name of the Firestore database"
  type        = string
  default     = "(default)"
}

# CPLX-6: this was a string carrying an enum — every caller had to remember the
# spelling of DELETE_PROTECTION_ENABLED, and a typo would have been accepted by
# the plan and rejected by the API. The mapping belongs in the module.
variable "delete_protection" {
  description = "Refuse to delete the database. Prod is true; dev and uat iterate."
  type        = bool
  default     = false
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
