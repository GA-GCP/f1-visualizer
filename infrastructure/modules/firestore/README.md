# `firestore` — User profiles and job status

One database per environment, plus the composite index the race-entry roster
query needs.

Prod has point-in-time recovery and daily backups; this is the only data in the
estate not derived from BigQuery or OpenF1 (REL-9). A `precondition` refuses to
create a prod database without delete protection.

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
| [google_firestore_backup_schedule.daily](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firestore_backup_schedule) | resource |
| [google_firestore_database.database](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firestore_database) | resource |
| [google_firestore_index.race_entries_by_year](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firestore_index) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_backup_retention_days"></a> [backup\_retention\_days](#input\_backup\_retention\_days) | Retention for the daily backup schedule, in days. Zero creates no schedule. Firestore allows 3 to 14 for daily backups. | `number` | `0` | no |
| <a name="input_database_name"></a> [database\_name](#input\_database\_name) | Name of the Firestore database | `string` | `"(default)"` | no |
| <a name="input_delete_protection"></a> [delete\_protection](#input\_delete\_protection) | Refuse to delete the database. Prod is true; dev and uat iterate. | `bool` | `false` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | The environment (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_point_in_time_recovery"></a> [point\_in\_time\_recovery](#input\_point\_in\_time\_recovery) | Keep a seven-day point-in-time read window. Costs storage proportional to write volume; off in dev, on in prod. | `bool` | `false` | no |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | Region the Firestore database lives in (e.g. us-central1) | `string` | n/a | yes |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_database_id"></a> [database\_id](#output\_database\_id) | Fully-qualified database id. |
| <a name="output_database_name"></a> [database\_name](#output\_database\_name) | Database name, e.g. f1v-db-dev. |
<!-- END_TF_DOCS -->
