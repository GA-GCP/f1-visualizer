variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "openf1_accessors" {
  description = "Members granted roles/secretmanager.secretAccessor on the OpenF1 credentials, as fully-qualified IAM members."
  type        = list(string)
  default     = []
}
