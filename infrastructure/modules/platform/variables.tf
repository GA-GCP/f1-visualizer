variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

# --- OPS-3: project services --------------------------------------------------
variable "enabled_apis" {
  description = "APIs the modules in this repository need. Enabled with disable_on_destroy = false, since disabling one takes every resource that uses it."
  type        = list(string)
  default = [
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "billingbudgets.googleapis.com",
    "certificatemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "dns.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "vpcaccess.googleapis.com",
  ]
}

# --- SEC-7: state bucket ------------------------------------------------------
variable "state_bucket" {
  description = "Name of the bucket root.hcl writes every unit's state into."
  type        = string
}

variable "state_bucket_location" {
  description = "Location of the state bucket"
  type        = string
  default     = "us-central1"
}

# --- CPLX-2 / OPS-4: registries -----------------------------------------------
variable "repository_id" {
  description = "Artifact Registry repository id, the same in every location."
  type        = string
  default     = "f1v-repo"
}

variable "registries" {
  description = "One entry per location a repository is needed in, keyed by a name used only in descriptions and resource addresses."
  type = map(object({
    location       = string
    writer_members = optional(list(string), [])
  }))
  default = {}
}

variable "immutable_tags" {
  description = "Refuse to re-point an existing tag. Requires the pipeline to stop pushing latest-<env> first; see OPS-4 in the module."
  type        = bool
  default     = false
}

# --- SEC-6: shared secrets ----------------------------------------------------
variable "shared_secret_ids" {
  description = "Secret containers shared by every environment. Values are added out of band so they never enter state."
  type        = list(string)
  default     = []
}

variable "shared_secret_accessors" {
  description = "Members granted roles/secretmanager.secretAccessor on every shared secret."
  type        = list(string)
  default     = []
}

# --- OPS-3: DNS ---------------------------------------------------------------
variable "dns_zone_name" {
  description = "Cloud DNS managed zone name. Empty means the zone is managed elsewhere and no zone is created."
  type        = string
  default     = ""
}

variable "dns_domain" {
  description = "Apex domain of the managed zone, without a trailing dot."
  type        = string
  default     = ""
}

# --- SEC-9 / OPS-3: audit and retention ---------------------------------------
variable "audit_log_services" {
  description = "Services whose Data Access reads and writes are recorded. These are the ones holding data an incident would ask about."
  type        = list(string)
  default = [
    "secretmanager.googleapis.com",
    "firestore.googleapis.com",
    "bigquery.googleapis.com",
  ]
}

variable "log_retention_days" {
  description = "Retention on the _Default log bucket. The platform default is 30 days, which is shorter than most questions worth asking."
  type        = number
  default     = 90
}

# --- SEC-9: org policies ------------------------------------------------------
variable "org_policies_enabled" {
  description = "Whether to set org policy constraints. Requires an organization; a standalone project cannot, and the apply fails rather than warning."
  type        = bool
  default     = false
}

variable "boolean_org_policies" {
  description = "Boolean constraints to enforce."
  type        = list(string)
  default = [
    # SEC-2's fix, made permanent: the default compute account never silently
    # receives Editor again.
    "constraints/iam.automaticIamGrantsForDefaultServiceAccounts",
    # A leaked service account key cannot be ruled out by policy unless keys
    # cannot be created.
    "constraints/iam.disableServiceAccountKeyCreation",
  ]
}
