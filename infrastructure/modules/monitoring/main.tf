# ==============================================================================
# OPS-1: monitoring, alerting and a budget
# ==============================================================================
# None of this existed anywhere in IaC — no uptime check, no alert policy, no
# notification channel, no SLO and no budget. The services expose
# /actuator/prometheus and /actuator/metrics and nothing scraped them. The first
# signal of a prod outage, a Redis eviction storm, a service pinned at
# max_instance_count or a runaway bill was a user or an invoice.

locals {
  # An alert with no channel is a graph nobody looks at. Policies are still
  # created without one so the thresholds are reviewable, but prod should set at
  # least one address.
  channels = [for c in google_monitoring_notification_channel.email : c.id]
}

resource "google_monitoring_notification_channel" "email" {
  for_each = toset(var.notification_emails)

  project      = var.project_id
  display_name = "F1V ${var.environment} — ${each.value}"
  type         = "email"

  labels = {
    email_address = each.value
  }
}

# ==============================================================================
# Uptime checks
# ==============================================================================
# /healthz is an exact-match location in nginx.conf that answers before the SPA
# fallback, so a 200 from it means the config loaded rather than meaning
# index.html happens to exist. It is the same path the Cloud Run startup probe
# uses, checked from outside the platform.
resource "google_monitoring_uptime_check_config" "frontend" {
  project      = var.project_id
  display_name = "f1v-frontend-${var.environment}"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/healthz"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.frontend_domain
    }
  }

  content_matchers {
    content = "ok"
    matcher = "CONTAINS_STRING"
  }
}

# The API check proves the edge is routing, not that a caller is authorised.
# /api/v1/analysis/years answers 401 without a token — and 200 when Cloud CDN has
# it warm (PERF-7) — so both are accepted. A 404 means the URL map lost the path
# rule; a 5xx means the service is unwell. Either fails the check.
resource "google_monitoring_uptime_check_config" "api" {
  project      = var.project_id
  display_name = "f1v-api-${var.environment}"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/api/v1/analysis/years"
    port         = 443
    use_ssl      = true
    validate_ssl = true

    accepted_response_status_codes {
      status_value = 200
    }

    accepted_response_status_codes {
      status_value = 401
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.api_domain
    }
  }
}

resource "google_monitoring_alert_policy" "uptime" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — endpoint unreachable"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "An uptime check has failed from more than one region. Check the load balancer's backend health and the Cloud Run service's revisions."
    mime_type = "text/markdown"
  }

  dynamic "conditions" {
    for_each = {
      frontend = google_monitoring_uptime_check_config.frontend.uptime_check_id
      api      = google_monitoring_uptime_check_config.api.uptime_check_id
    }

    content {
      display_name = "${conditions.key} uptime check failing"

      condition_threshold {
        filter = join(" AND ", [
          "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
          "resource.type=\"uptime_url\"",
          "metric.label.check_id=\"${conditions.value}\"",
        ])
        comparison      = "COMPARISON_GT"
        threshold_value = 1
        duration        = "300s"

        aggregations {
          alignment_period     = "300s"
          per_series_aligner   = "ALIGN_NEXT_OLDER"
          cross_series_reducer = "REDUCE_COUNT_FALSE"
          group_by_fields      = ["resource.label.host"]
        }

        trigger {
          count = 1
        }
      }
    }
  }

  notification_channels = local.channels
}

# ==============================================================================
# Edge: error rate and latency
# ==============================================================================
resource "google_monitoring_alert_policy" "lb_errors" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — load balancer 5xx"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "The edge is returning server errors. OPS-2 turned on request logging; the logs will say which backend and which path."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "5xx responses above 1/s for 5 minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"loadbalancing.googleapis.com/https/request_count\"",
        "resource.type=\"https_lb_rule\"",
        "metric.label.response_code_class=\"500\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.url_map_name"]
      }
    }
  }

  notification_channels = local.channels
}

resource "google_monitoring_alert_policy" "lb_latency" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — p95 latency"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "p95 request latency at the edge is above 5 seconds. A BigQuery-backed analysis call is the usual cause; a cold start is the other."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "p95 above 5s for 10 minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"loadbalancing.googleapis.com/https/total_latencies\"",
        "resource.type=\"https_lb_rule\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      duration        = "600s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.url_map_name"]
      }
    }
  }

  notification_channels = local.channels
}

# ==============================================================================
# Cloud Run: saturation
# ==============================================================================
# A service sitting at max_instance_count is shedding load, and nothing said so.
# The threshold is deliberately below the module default of 5 — the point is to
# hear about it before it becomes 429s at the edge.
resource "google_monitoring_alert_policy" "run_saturation" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — Cloud Run instances near ceiling"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "A service is running close to its max_instance_count. Either traffic has grown or something is holding instances open; the replay worker is capped at one by design and should never appear here."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "4 or more active instances for 10 minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/container/instance_count\"",
        "resource.type=\"cloud_run_revision\"",
        "metric.label.state=\"active\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 4
      duration        = "600s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }
    }
  }

  notification_channels = local.channels
}

resource "google_monitoring_alert_policy" "run_errors" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — Cloud Run 5xx"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "A service is returning 5xx. A revision that never passes its readiness probe shows up here as well, because the platform answers for it — REL-3 is the recent example."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "5xx responses above 0.5/s for 5 minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "metric.label.response_code_class=\"5xx\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 0.5
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }
    }
  }

  notification_channels = local.channels
}

# ==============================================================================
# Memorystore
# ==============================================================================
# The cache holds live telemetry fan-out and replay state. Eviction here is not a
# cache miss, it is a dropped frame for every connected browser.
resource "google_monitoring_alert_policy" "redis" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — Memorystore pressure"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "Redis is filling or evicting. The instance is 1 GiB; a replay buffers ~100k objects, so a long session or a leaked key space is the usual cause."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Memory usage above 80%"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\"",
        "resource.type=\"redis_instance\"",
        "resource.label.instance_id=\"${var.redis_instance_id}\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  conditions {
    display_name = "Keys being evicted"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"redis.googleapis.com/stats/evicted_keys\"",
        "resource.type=\"redis_instance\"",
        "resource.label.instance_id=\"${var.redis_instance_id}\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.channels
}

# ==============================================================================
# Delivery
# ==============================================================================
resource "google_monitoring_alert_policy" "build_failures" {
  project      = var.project_id
  display_name = "F1V ${var.environment} — Cloud Build failure"
  combiner     = "OR"
  enabled      = var.alerts_enabled

  documentation {
    content   = "A pipeline failed. For the infrastructure pipeline in prod this may be an apply that stopped partway, since units apply in sequence."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "A build finished in a failure state"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudbuild.googleapis.com/build/count\"",
        "resource.type=\"build\"",
        "metric.label.status=\"FAILURE\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.channels
}

# ==============================================================================
# Budget
# ==============================================================================
# The run-rate estimate in the audit puts the estate near $850 a month, of which
# roughly $400 is always-on compute in environments with no users overnight
# (PERF-4). A budget is how that stops being discovered on an invoice.
resource "google_billing_budget" "environment" {
  count = var.billing_account == "" ? 0 : 1

  billing_account = var.billing_account
  display_name    = "F1V ${var.environment}"

  budget_filter {
    projects = ["projects/${var.project_id}"]
    labels = {
      env = var.environment
    }
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content {
      threshold_percent = threshold_rules.value
    }
  }

  all_updates_rule {
    monitoring_notification_channels = local.channels
    disable_default_iam_recipients   = false
  }
}
