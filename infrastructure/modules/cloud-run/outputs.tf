output "service_url" {
  description = "The service's *.run.app URL. Not the public entry point — that is the load balancer."
  value       = google_cloud_run_v2_service.service.uri
}

output "service_name" {
  description = "Service name, used by the load-balancer units to build their serverless NEGs."
  value       = google_cloud_run_v2_service.service.name
}
