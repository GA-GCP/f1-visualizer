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
# SEC-3: dev, uat and prod share one project, so a project-level
# roles/datastore.user let sa-f1v-user-dev write to f1v-db-prod. The binding is
# conditioned on this database's resource name instead.
variable "firestore_database_id" {
  description = "Firestore database this environment's identities may reach (e.g. f1v-db-dev)"
  type        = string
}
