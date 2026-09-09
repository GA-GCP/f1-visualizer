# CPLX-6: the eight table schemas were JSON heredocs inside HCL, which no JSON
# tool could read and no editor could check. They are files under schemas/ now,
# loaded with file() — which also means the Java tests can assert against the
# same definitions the tables are created from, rather than a transcription.
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

  # PERF-6: seven days of time travel on tables that only ever grow by append.
  # Two days still covers "undo the load that just went wrong", which is the only
  # recovery this data needs, and stops paying to keep five more days of a
  # snapshot of the largest table in the project.
  max_time_travel_hours = var.max_time_travel_hours

  # PERF-6: telemetry and locations rows compress hard, and logical billing bills
  # the uncompressed size. PHYSICAL is usually the cheaper of the two here — but
  # it is a 14-day commitment once set, so it stays off until the ratio is
  # measured rather than assumed:
  #
  #   SELECT table_name,
  #          SUM(total_logical_bytes)  AS logical,
  #          SUM(total_physical_bytes) AS physical
  #   FROM `<project>.<dataset>.INFORMATION_SCHEMA.TABLE_STORAGE`
  #   GROUP BY table_name ORDER BY logical DESC
  #
  # Switch when logical is comfortably more than physical across the dataset.
  storage_billing_model = var.storage_billing_model

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

  # PERF-6: read by session_key on every request and scanned end to end, because
  # this table is neither partitioned nor clustered. There is no date column to
  # partition on, so clustering is what bounds the scan. telemetry and locations
  # have had this since P2.
  clustering = ["session_key", "driver_number"]

  # Schema matching LapDataRecord.java + OpenF1 fields
  schema = file("${path.module}/schemas/laps.json")
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

  schema = file("${path.module}/schemas/telemetry.json")
}

# 3. DRIVERS TABLE (Reference Data)
resource "google_bigquery_table" "drivers" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "drivers"
  project    = var.project_id

  schema = file("${path.module}/schemas/drivers.json")
}

# 4. SESSIONS TABLE (Reference Data)
resource "google_bigquery_table" "sessions" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "sessions"
  project    = var.project_id

  schema = file("${path.module}/schemas/sessions.json")
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

  schema = file("${path.module}/schemas/locations.json")
}

# 6. RESULTS TABLE (For Versus Mode Stats)
resource "google_bigquery_table" "results" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "results"
  project    = var.project_id

  # PERF-6: read by session_key on every request and scanned end to end, because
  # this table is neither partitioned nor clustered. There is no date column to
  # partition on, so clustering is what bounds the scan. telemetry and locations
  # have had this since P2.
  clustering = ["session_key", "driver_number"]

  schema = file("${path.module}/schemas/results.json")
}

# 7. SESSION_DRIVERS TABLE (Per-race driver rosters with team at time of race)
resource "google_bigquery_table" "session_drivers" {
  dataset_id = google_bigquery_dataset.f1_dataset.dataset_id
  table_id   = "session_drivers"
  project    = var.project_id

  # PERF-6: read by session_key on every request and scanned end to end, because
  # this table is neither partitioned nor clustered. There is no date column to
  # partition on, so clustering is what bounds the scan. telemetry and locations
  # have had this since P2.
  clustering = ["session_key", "year"]

  schema = file("${path.module}/schemas/session_drivers.json")
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

  schema = file("${path.module}/schemas/driver_stats.json")
}

# 9. INGESTION_JOBS TABLE is deliberately absent: job status lives in Firestore,
#    which is already the services' low-latency store and does not carry
#    BigQuery's streaming-buffer semantics (R3).
