output "network_id" {
  description = "The ID of the VPC Network"
  value       = google_compute_network.f1v_vpc.id
}

output "network_name" {
  description = "The Name of the VPC Network"
  value       = google_compute_network.f1v_vpc.name
}

output "subnetwork_id" {
  description = "The ID of the primary Subnet"
  value       = google_compute_subnetwork.f1v_subnet.id
}

# PERF-1: what a Cloud Run service attaches to, in place of
# vpc_access_connector_id. The v2 API's network_interfaces block takes names or
# self-links; names are what the units read most clearly.
output "subnetwork_name" {
  description = "Name of the subnet Cloud Run attaches to with direct VPC egress"
  value       = google_compute_subnetwork.f1v_subnet.name
}
