variable "project_id" { type = string }
variable "region" { type = string }
variable "gateway_id" { type = string }
variable "openapi_spec" {
  description = "The content of the OpenAPI YAML file"
  type        = string
}