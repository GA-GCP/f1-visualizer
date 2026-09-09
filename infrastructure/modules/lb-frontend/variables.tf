variable "project_id" { type = string }
variable "region" { type = string }
variable "name_prefix" { type = string }
variable "domain" { type = string }
variable "cloud_run_service_name" { type = string }
variable "enable_adaptive_protection" {
  description = "Cloud Armor Adaptive Protection (layer 7 DDoS defence). Requires Cloud Armor Enterprise, which is billed separately."
  type        = bool
  default     = false
}

variable "dns_zone_name" {
  description = "Cloud DNS managed zone this edge adds its records to, from the platform layer. Empty means DNS is managed elsewhere and no records or Certificate Manager resources are created."
  type        = string
  default     = ""
}

variable "use_certificate_manager" {
  description = "Serve from the Certificate Manager map instead of the classic managed certificate. Flip only once the certificate reports ACTIVE (SEC-5)."
  type        = bool
  default     = false
}
