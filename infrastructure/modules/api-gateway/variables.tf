variable "project_id" { type = string }
variable "region" { type = string }
variable "gateway_id" { type = string }
variable "openapi_spec" {
  description = "The content of the OpenAPI YAML file"
  type        = string
}
variable "backend_auth_service_account" {
  description = "Service account the gateway uses to authenticate to private Cloud Run backends. Needs roles/run.invoker on each."
  type        = string
}
