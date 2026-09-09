variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment environment (e.g., dev, uat, prod)"
  type        = string
}
# SEC-3: dev, uat and prod share one project, so a project-level
# roles/datastore.user let sa-f1v-user-dev write to f1v-db-prod. The binding is
# conditioned on this database's resource name instead.
variable "firestore_database_id" {
  description = "Firestore database this environment's identities may reach (e.g. f1v-db-dev)"
  type        = string
}
