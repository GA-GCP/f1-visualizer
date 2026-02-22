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