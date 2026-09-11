# `monitoring` — Uptime, alerts and a budget

Uptime checks, alert policies for the edge, Cloud Run, Memorystore and Cloud
Build, and a billing budget (OPS-1). None of this existed.

Two inputs cannot come from this repository and default to empty rather than to a
plausible-looking value: `notification_emails` and `billing_account`. Until they
are set the policies exist and are reviewable, but nothing is told when they
fire.

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
| ---- | ------- |
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | ~> 1.12 |
| <a name="requirement_google"></a> [google](#requirement\_google) | ~> 8.1 |

## Providers

| Name | Version |
| ---- | ------- |
| <a name="provider_google"></a> [google](#provider\_google) | 8.2.0 |

## Modules

No modules.

## Resources

| Name | Type |
| ---- | ---- |
| [google_billing_budget.environment](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/billing_budget) | resource |
| [google_monitoring_alert_policy.build_failures](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.lb_errors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.lb_latency](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.redis](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.run_errors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.run_saturation](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_alert_policy.uptime](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy) | resource |
| [google_monitoring_notification_channel.email](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_notification_channel) | resource |
| [google_monitoring_uptime_check_config.api](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_uptime_check_config) | resource |
| [google_monitoring_uptime_check_config.frontend](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_uptime_check_config) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_alerts_enabled"></a> [alerts\_enabled](#input\_alerts\_enabled) | Whether the alert policies are enabled. Off in dev by default: an environment with no users overnight generates noise, not signal. | `bool` | `true` | no |
| <a name="input_api_domain"></a> [api\_domain](#input\_api\_domain) | Host the API uptime check probes (e.g. dev.api.f1visualizer.com) | `string` | n/a | yes |
| <a name="input_billing_account"></a> [billing\_account](#input\_billing\_account) | Billing account id (e.g. 01ABCD-234567-89EFGH). Empty means no budget is created — the budget needs an account this repository cannot discover. | `string` | `""` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | The environment (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_frontend_domain"></a> [frontend\_domain](#input\_frontend\_domain) | Host the frontend uptime check probes (e.g. dev.f1visualizer.com) | `string` | n/a | yes |
| <a name="input_monthly_budget_usd"></a> [monthly\_budget\_usd](#input\_monthly\_budget\_usd) | Monthly budget for this environment, in USD. Alerts fire at 50, 90 and 100 percent. | `number` | `400` | no |
| <a name="input_notification_emails"></a> [notification\_emails](#input\_notification\_emails) | Addresses that receive alerts. An empty list creates the policies with no channel, which is a silent alert — set at least one for prod. | `list(string)` | `[]` | no |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_redis_instance_id"></a> [redis\_instance\_id](#input\_redis\_instance\_id) | Memorystore instance id the cache alerts filter on (e.g. f1v-redis-dev) | `string` | n/a | yes |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_notification_channel_ids"></a> [notification\_channel\_ids](#output\_notification\_channel\_ids) | Channels the alert policies notify. Empty means the policies exist but nothing is told when they fire. |
<!-- END_TF_DOCS -->
