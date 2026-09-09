output "static_ip" {
  description = "IPv4 address for the A record"
  value       = google_compute_global_address.default.address
}

output "static_ipv6" {
  description = "IPv6 address for the AAAA record (SEC-5)"
  value       = google_compute_global_address.ipv6.address
}