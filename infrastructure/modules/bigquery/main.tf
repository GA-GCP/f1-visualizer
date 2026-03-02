resource "google_bigquery_dataset" "f1_dataset" {
  dataset_id                  = "f1_dataset" # Hardcoded to match Java constant
  friendly_name               = "F1 Telemetry Data (${var.environment})"
  description                 = "Storage for historical lap times and telemetry for F1 Visualizer"
  location                    = var.location
  project                     = var.project_id
  default_table_expiration_ms = null # Data persists forever

  labels = {
    env = var.environment
  }
}

# 1. LAPS TABLE (Used by RaceAnalysisService)
resource "google_bigquery_table" "laps" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "laps"
  project    = var.project_id

  # Schema matching LapDataRecord.java + OpenF1 fields
  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "meeting_key", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "lap_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "lap_duration", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "sector_1_duration", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "sector_2_duration", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "sector_3_duration", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "compound", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

# 2. TELEMETRY TABLE (For detailed historical replays)
resource "google_bigquery_table" "telemetry" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "telemetry"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  clustering = ["session_key", "driver_number"]

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "date", "type": "TIMESTAMP", "mode": "REQUIRED" },
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "speed", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "rpm", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "gear", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "throttle", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "brake", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "drs", "type": "INTEGER", "mode": "NULLABLE" }
]
EOF
}

# 3. DRIVERS TABLE (Reference Data)
resource "google_bigquery_table" "drivers" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "drivers"
  project    = var.project_id

  schema = <<EOF
[
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "broadcast_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "team_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "team_colour", "type": "STRING", "mode": "NULLABLE" },
  { "name": "country_code", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

# 4. SESSIONS TABLE (Reference Data)
resource "google_bigquery_table" "sessions" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "sessions"
  project    = var.project_id

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "session_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "meeting_key", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "meeting_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "year", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "country_name", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

# 5. LOCATIONS TABLE (For Circuit Trace Replay)
resource "google_bigquery_table" "locations" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "locations"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  clustering = ["session_key", "driver_number"]

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "date", "type": "TIMESTAMP", "mode": "REQUIRED" },
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "x", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "y", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "z", "type": "INTEGER", "mode": "NULLABLE" }
]
EOF
}

# 6. RESULTS TABLE (For Versus Mode Stats)
resource "google_bigquery_table" "results" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "results"
  project    = var.project_id

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "position", "type": "INTEGER", "mode": "NULLABLE" }
]
EOF
}