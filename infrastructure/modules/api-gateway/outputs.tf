output "default_hostname" {
  description = "The default hostname of the API Gateway (e.g., my-gateway-xxx.uc.gateway.dev)"
  value       = google_api_gateway_gateway.gateway.default_hostname
}
