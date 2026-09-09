resource "google_bigquery_dataset" "f1_dataset" {
  # CPLX-2: this was hard-coded to "f1_dataset", declared only in
  # environments/dev, and read and written by all three environments — so a UAT
  # historical load wrote into the tables prod reads. The backend has honoured
  # F1V_BIGQUERY_DATASET since C4; nothing ever set it.
  dataset_id                  = var.dataset_id
  friendly_name               = "F1 Telemetry Data (${var.environment})"
  description                 = "Storage for historical lap times and telemetry for F1 Visualizer"
  location                    = var.location
  project                     = var.project_id
  default_table_expiration_ms = null # Data persists forever

}

# SEC-3: roles/bigquery.dataEditor and roles/bigquery.dataViewer were project
# level, so every BigQuery identity could read and write every dataset. Granted
# on the dataset instead. roles/bigquery.jobUser stays at project level, since
# running a query job genuinely is a project-scoped permission.
resource "google_bigquery_dataset_iam_member" "editors" {
  for_each = toset(var.dataset_editors)

  project    = var.project_id
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = each.value
}

resource "google_bigquery_dataset_iam_member" "viewers" {
  for_each = toset(var.dataset_viewers)

  project    = var.project_id
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = each.value
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
  { "name": "compound", "type": "STRING", "mode": "NULLABLE" },
  { "name": "date_start", "type": "TIMESTAMP", "mode": "NULLABLE" },
  { "name": "is_pit_out_lap", "type": "BOOLEAN", "mode": "NULLABLE" }
]
EOF
}

# 2. TELEMETRY TABLE (For detailed historical replays)
resource "google_bigquery_table" "telemetry" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "telemetry"
  project    = var.project_id

  # P2: the driver-stats query used to scan this table end to end on every
  # /drivers/{id}/stats call because it carried no date predicate. Stats are
  # precomputed now, and this makes the same mistake fail at query time rather
  # than quietly bill its way through the largest table in the dataset.
  require_partition_filter = true

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  clustering = ["session_key", "driver_number"]

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "meeting_key", "type": "INTEGER", "mode": "NULLABLE" },
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
  { "name": "name_acronym", "type": "STRING", "mode": "NULLABLE" },
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
  { "name": "country_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "date_start", "type": "TIMESTAMP", "mode": "NULLABLE" },
  { "name": "date_end", "type": "TIMESTAMP", "mode": "NULLABLE" }
]
EOF
}

# 5. LOCATIONS TABLE (For Circuit Trace Replay)
resource "google_bigquery_table" "locations" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "locations"
  project    = var.project_id

  # Every read of this table is a replay window, which is a date range by
  # construction; the constraint costs nothing and closes the same hole (P2).
  require_partition_filter = true

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  clustering = ["session_key", "driver_number"]

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "meeting_key", "type": "INTEGER", "mode": "NULLABLE" },
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

# 7. SESSION_DRIVERS TABLE (Per-race driver rosters with team at time of race)
resource "google_bigquery_table" "session_drivers" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "session_drivers"
  project    = var.project_id

  schema = <<EOF
[
  { "name": "session_key", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "year", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "broadcast_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "name_acronym", "type": "STRING", "mode": "NULLABLE" },
  { "name": "team_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "team_colour", "type": "STRING", "mode": "NULLABLE" },
  { "name": "country_code", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

# 8. DRIVER_STATS TABLE (Precomputed radar and career figures)
#
# P2: these numbers change only when a session is loaded, but the ten-CTE query
# behind them ran per request — including COUNTIF(throttle > 95) across the whole
# telemetry table — and the head-to-head page issues two per comparison. The
# ingestion run that changes the inputs now writes the answers here, and the
# analysis service reads a table of ~20 rows.
resource "google_bigquery_table" "driver_stats" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "driver_stats"
  project    = var.project_id

  schema = <<EOF
[
  { "name": "driver_number", "type": "INTEGER", "mode": "REQUIRED" },
  { "name": "avg_position", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "position_stddev", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "full_throttle_pct", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "avg_stint_length", "type": "FLOAT", "mode": "NULLABLE" },
  { "name": "total_races", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "wins", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "podiums", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "total_points", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "best_finish", "type": "INTEGER", "mode": "NULLABLE" },
  { "name": "teams_list", "type": "STRING", "mode": "NULLABLE" },
  { "name": "computed_at", "type": "TIMESTAMP", "mode": "REQUIRED" }
]
EOF
}

# 9. INGESTION_JOBS TABLE is deliberately absent: job status lives in Firestore,
#    which is already the services' low-latency store and does not carry
#    BigQuery's streaming-buffer semantics (R3).
