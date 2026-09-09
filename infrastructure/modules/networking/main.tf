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
  name          = "${var.network_name}-subnet"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.f1v_vpc.id
  ip_cidr_range = "10.0.0.0/24" # 256 IPs per environment is plenty for our use-case

  # Enable Private Google Access so resources in this subnet can reach GCP APIs without public IPs
  private_ip_google_access = true
}

# ==============================================================================
# 3. FIREWALL RULES
# ==============================================================================
# The only thing that crosses this VPC is Cloud Run reaching Redis through the
# serverless connector, so that is the only thing the firewall allows. The rule
# this replaced opened every TCP and UDP port to the whole subnet, which made
# the VPC a flat trust zone around an unauthenticated cache (S2).
resource "google_compute_firewall" "allow_redis_from_connector" {
  name        = "${var.network_name}-allow-redis"
  project     = var.project_id
  network     = google_compute_network.f1v_vpc.id
  description = "Serverless VPC Access connector -> Memorystore Redis"

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  source_ranges = [var.connector_cidr]
}

# Health checks and connector management traffic originate from the connector
# range as well; ICMP is kept for reachability diagnostics only.
resource "google_compute_firewall" "allow_icmp_from_connector" {
  name        = "${var.network_name}-allow-icmp"
  project     = var.project_id
  network     = google_compute_network.f1v_vpc.id
  description = "Reachability diagnostics from the serverless connector"

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.connector_cidr]
}

# ==============================================================================
# 4. SERVERLESS VPC ACCESS CONNECTOR
# ==============================================================================
# This allows Cloud Run services to reach internal IPs (like Redis) within the VPC.
resource "google_vpc_access_connector" "connector" {
  name          = "${var.network_name}-conn"
  project       = var.project_id
  region        = var.region
  ip_cidr_range = var.connector_cidr
  network       = google_compute_network.f1v_vpc.name
  min_throughput = 200
  max_throughput = 300
}