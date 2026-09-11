# `bigquery` — Historical F1 data

One dataset per environment (CPLX-2) and the eight tables the analysis and
replay services read. Schemas live in `schemas/*.json` rather than as heredocs
inside HCL, so a JSON tool can read them and the Java tests can assert against
the same file the table is created from (CPLX-6).

`telemetry` and `locations` are partitioned by day, clustered, and require a
partition filter — a query with no date predicate fails rather than quietly
billing its way through the largest table in the project (P2). `laps`, `results`
and `session_drivers` have no date column, so clustering is what bounds their
scans (PERF-6).

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
| [google_bigquery_dataset.f1_dataset](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_dataset) | resource |
| [google_bigquery_dataset_iam_member.editors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_dataset_iam_member) | resource |
| [google_bigquery_dataset_iam_member.viewers](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_dataset_iam_member) | resource |
| [google_bigquery_table.driver_stats](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.drivers](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.laps](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.locations](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.results](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.session_drivers](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.sessions](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |
| [google_bigquery_table.telemetry](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_table) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_dataset_editors"></a> [dataset\_editors](#input\_dataset\_editors) | Members granted roles/bigquery.dataEditor on this dataset, as fully-qualified IAM members. | `list(string)` | `[]` | no |
| <a name="input_dataset_id"></a> [dataset\_id](#input\_dataset\_id) | BigQuery dataset id. Per environment: the services read it from F1V\_BIGQUERY\_DATASET. | `string` | n/a | yes |
| <a name="input_dataset_viewers"></a> [dataset\_viewers](#input\_dataset\_viewers) | Members granted roles/bigquery.dataViewer on this dataset, as fully-qualified IAM members. | `list(string)` | `[]` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | The environment (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_location"></a> [location](#input\_location) | The location for the BigQuery Dataset | `string` | `"US"` | no |
| <a name="input_max_time_travel_hours"></a> [max\_time\_travel\_hours](#input\_max\_time\_travel\_hours) | Time travel window. The default is 168 (seven days); these tables only grow by append, so two days covers the recovery they need. | `number` | `48` | no |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_storage_billing_model"></a> [storage\_billing\_model](#input\_storage\_billing\_model) | LOGICAL bills uncompressed size, PHYSICAL bills what is stored. PHYSICAL is a 14-day commitment; measure the ratio first (see main.tf). | `string` | `"LOGICAL"` | no |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_dataset_id"></a> [dataset\_id](#output\_dataset\_id) | Dataset id, read by the services as F1V\_BIGQUERY\_DATASET. |
<!-- END_TF_DOCS -->
