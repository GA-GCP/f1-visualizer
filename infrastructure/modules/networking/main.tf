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
# Allow internal traffic within the VPC (e.g., Cloud Run talking to Redis)
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.network_name}-allow-internal"
  project = var.project_id
  network = google_compute_network.f1v_vpc.id

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/24"]
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