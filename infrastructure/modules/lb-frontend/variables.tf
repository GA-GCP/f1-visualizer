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
