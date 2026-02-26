variable "project_id" { type = string }
variable "name_prefix" { type = string }
variable "domain" { type = string }
variable "api_gateway_fqdn" {
  description = "The default hostname of the API Gateway (e.g., my-gateway-xxx.uc.gateway.dev)"
  type = string
}