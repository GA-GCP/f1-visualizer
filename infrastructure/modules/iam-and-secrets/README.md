# `iam-and-secrets` — Every identity in an environment

Six runtime service accounts, one per service, and two CI accounts.

The CI split is the point (SEC-1): `sa-f1v-deploy-<env>` runs the application
pipelines, which execute `./mvnw verify` and `yarn install` with lifecycle
scripts, and cannot change IAM. `sa-f1v-infra-<env>` runs only Terragrunt. Its
`projectIamAdmin` grant carries an IAM condition restricting the roles it may
hand out to the ones this repository declares, so it cannot grant itself Owner.

Data and secret access is granted on the resources — see the `redis`, `bigquery`
and `platform` modules — because a project-level grant crosses every environment
boundary in a single-project estate (SEC-3).

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
| [google_project_iam_member.data_analysis_bq_job_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.data_analysis_datastore_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.data_ingestion_bq_job_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.data_ingestion_datastore_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.deploy_log_writer](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.deploy_run_developer](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.deploy_run_viewer](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.infra_project_iam_admin](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.infra_roles](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.replay_worker_bq_job_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_iam_member.user_datastore_user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_service_account.data_analysis](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.data_ingestion](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.deploy](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.frontend](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.infra](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.replay_worker](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.telemetry](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account.user](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account_iam_member.deploy_acts_as_runtime](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account_iam_member) | resource |
| [google_service_account_iam_member.infra_acts_as_runtime](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account_iam_member) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_environment"></a> [environment](#input\_environment) | The environment (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_firestore_database_id"></a> [firestore\_database\_id](#input\_firestore\_database\_id) | Firestore database this environment's identities may reach (e.g. f1v-db-dev) | `string` | n/a | yes |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_sa_data_analysis_email"></a> [sa\_data\_analysis\_email](#output\_sa\_data\_analysis\_email) | Identity the analysis service runs as. |
| <a name="output_sa_data_ingestion_email"></a> [sa\_data\_ingestion\_email](#output\_sa\_data\_ingestion\_email) | Identity the ingestion service runs as. |
| <a name="output_sa_deploy_email"></a> [sa\_deploy\_email](#output\_sa\_deploy\_email) | Identity the backend and frontend pipelines run as (SEC-1). |
| <a name="output_sa_frontend_email"></a> [sa\_frontend\_email](#output\_sa\_frontend\_email) | Identity the SPA runs as. Holds no bindings anywhere, by design (SEC-2). |
| <a name="output_sa_infra_email"></a> [sa\_infra\_email](#output\_sa\_infra\_email) | Identity the infrastructure pipeline runs as (SEC-1). |
| <a name="output_sa_replay_worker_email"></a> [sa\_replay\_worker\_email](#output\_sa\_replay\_worker\_email) | Identity the replay worker runs as. |
| <a name="output_sa_telemetry_email"></a> [sa\_telemetry\_email](#output\_sa\_telemetry\_email) | Identity the telemetry broker runs as. |
| <a name="output_sa_user_email"></a> [sa\_user\_email](#output\_sa\_user\_email) | Identity the user service runs as. |
<!-- END_TF_DOCS -->
