# ==============================================================================
# 1. VPC NETWORK
# ==============================================================================
resource "google_compute_network" "f1v_vpc" {
  name                    = var.network_name
  project                 = var.project_id
  auto_create_subnetworks = false # Custom subnets for tight security control
  routing_mode            = "REGIONAL"
}

# ==============================================================================
# 2. SUBNETWORK (For General Compute & Serverless Egress)
# ==============================================================================
resource "google_compute_subnetwork" "f1v_subnet" {
  name    = "${var.network_name}-subnet"
  project = var.project_id
  region  = var.region
  network = google_compute_network.f1v_vpc.id
  # PERF-1: this subnet used to be declared and unused. It is now what Cloud Run
  # attaches to directly. Each instance takes one address, so a /24 is ample.
  ip_cidr_range = var.subnet_cidr

  # Enable Private Google Access so resources in this subnet can reach GCP APIs without public IPs
  private_ip_google_access = true
}

# ==============================================================================
# 3. FIREWALL RULES
# ==============================================================================
# The only thing that crosses this VPC is Cloud Run reaching Redis, so that is
# the only thing the firewall allows. The rule this replaced opened every TCP and
# UDP port to the whole subnet, which made the VPC a flat trust zone around an
# unauthenticated cache (S2).
#
# PERF-1: the source is the subnet the Cloud Run instances now sit in, rather
# than the connector range they used to arrive from.
resource "google_compute_firewall" "allow_redis_from_services" {
  name        = "${var.network_name}-allow-redis"
  project     = var.project_id
  network     = google_compute_network.f1v_vpc.id
  description = "Cloud Run direct VPC egress -> Memorystore Redis"

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  source_ranges = [var.subnet_cidr]
}
