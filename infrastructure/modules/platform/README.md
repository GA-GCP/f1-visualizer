# `platform` — What the environments share

The state bucket, both Artifact Registry repositories, the OpenF1 secret
containers, the enabled APIs, the DNS zone, Data Access audit logging and the org
policies.

It exists so that none of these live inside `environments/dev`, where a
`run --all destroy` would have taken production's images with them (CPLX-2,
REL-8, SEC-7, OPS-3, SEC-9, OPS-4). Applying it is a separate act from applying
an environment.

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
| [google_artifact_registry_repository.repo](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/artifact_registry_repository) | resource |
| [google_artifact_registry_repository_iam_member.writers](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/artifact_registry_repository_iam_member) | resource |
| [google_cloudbuildv2_connection.github](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuildv2_connection) | resource |
| [google_cloudbuildv2_repository.repo](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuildv2_repository) | resource |
| [google_dns_managed_zone.primary](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_managed_zone) | resource |
| [google_iam_workload_identity_pool.github](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/iam_workload_identity_pool) | resource |
| [google_iam_workload_identity_pool_provider.github](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/iam_workload_identity_pool_provider) | resource |
| [google_logging_project_bucket_config.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/logging_project_bucket_config) | resource |
| [google_project_iam_audit_config.data_access](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_audit_config) | resource |
| [google_project_iam_member.planner_viewer](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_iam_member) | resource |
| [google_project_organization_policy.boolean_constraints](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_organization_policy) | resource |
| [google_project_service.apis](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/project_service) | resource |
| [google_secret_manager_secret.shared](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret) | resource |
| [google_secret_manager_secret_iam_member.shared_accessors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret_iam_member) | resource |
| [google_service_account.planner](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account) | resource |
| [google_service_account_iam_member.planner_federation](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/service_account_iam_member) | resource |
| [google_storage_bucket.tfstate](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/storage_bucket) | resource |
| [google_storage_bucket_iam_member.planner_state_reader](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/storage_bucket_iam_member) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_audit_log_services"></a> [audit\_log\_services](#input\_audit\_log\_services) | Services whose Data Access reads and writes are recorded. These are the ones holding data an incident would ask about. | `list(string)` | <pre>[<br/>  "secretmanager.googleapis.com",<br/>  "firestore.googleapis.com",<br/>  "bigquery.googleapis.com"<br/>]</pre> | no |
| <a name="input_boolean_org_policies"></a> [boolean\_org\_policies](#input\_boolean\_org\_policies) | Boolean constraints to enforce. | `list(string)` | <pre>[<br/>  "constraints/iam.automaticIamGrantsForDefaultServiceAccounts",<br/>  "constraints/iam.disableServiceAccountKeyCreation"<br/>]</pre> | no |
| <a name="input_cloudbuild_connection_region"></a> [cloudbuild\_connection\_region](#input\_cloudbuild\_connection\_region) | Region the connection and repository live in. Must match the triggers' region. | `string` | `"us-central1"` | no |
| <a name="input_dns_domain"></a> [dns\_domain](#input\_dns\_domain) | Apex domain of the managed zone, without a trailing dot. | `string` | `""` | no |
| <a name="input_dns_zone_name"></a> [dns\_zone\_name](#input\_dns\_zone\_name) | Cloud DNS managed zone name. Empty means the zone is managed elsewhere and no zone is created. | `string` | `""` | no |
| <a name="input_enabled_apis"></a> [enabled\_apis](#input\_enabled\_apis) | APIs the modules in this repository need. Enabled with disable\_on\_destroy = false, since disabling one takes every resource that uses it. | `list(string)` | <pre>[<br/>  "artifactregistry.googleapis.com",<br/>  "bigquery.googleapis.com",<br/>  "billingbudgets.googleapis.com",<br/>  "certificatemanager.googleapis.com",<br/>  "cloudbilling.googleapis.com",<br/>  "cloudbuild.googleapis.com",<br/>  "cloudresourcemanager.googleapis.com",<br/>  "compute.googleapis.com",<br/>  "dns.googleapis.com",<br/>  "firestore.googleapis.com",<br/>  "iam.googleapis.com",<br/>  "logging.googleapis.com",<br/>  "monitoring.googleapis.com",<br/>  "redis.googleapis.com",<br/>  "run.googleapis.com",<br/>  "secretmanager.googleapis.com",<br/>  "serviceusage.googleapis.com",<br/>  "storage.googleapis.com",<br/>  "vpcaccess.googleapis.com"<br/>]</pre> | no |
| <a name="input_github_app_installation_id"></a> [github\_app\_installation\_id](#input\_github\_app\_installation\_id) | Installation id of the Cloud Build GitHub App. Empty leaves the triggers on the first-generation github block. | `string` | `""` | no |
| <a name="input_github_repository"></a> [github\_repository](#input\_github\_repository) | owner/repo allowed to federate as the read-only planner. Empty creates no federation. | `string` | `""` | no |
| <a name="input_github_token_secret_version"></a> [github\_token\_secret\_version](#input\_github\_token\_secret\_version) | Secret Manager version holding a GitHub PAT with repo scope, e.g. projects/P/secrets/S/versions/1. | `string` | `""` | no |
| <a name="input_immutable_tags"></a> [immutable\_tags](#input\_immutable\_tags) | Refuse to re-point an existing tag. Requires the pipeline to stop pushing latest-<env> first; see OPS-4 in the module. | `bool` | `false` | no |
| <a name="input_log_retention_days"></a> [log\_retention\_days](#input\_log\_retention\_days) | Retention on the \_Default log bucket. The platform default is 30 days, which is shorter than most questions worth asking. | `number` | `90` | no |
| <a name="input_org_policies_enabled"></a> [org\_policies\_enabled](#input\_org\_policies\_enabled) | Whether to set org policy constraints. Requires an organization; a standalone project cannot, and the apply fails rather than warning. | `bool` | `false` | no |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_registries"></a> [registries](#input\_registries) | One entry per location a repository is needed in, keyed by a name used only in descriptions and resource addresses. | <pre>map(object({<br/>    location       = string<br/>    writer_members = optional(list(string), [])<br/>  }))</pre> | `{}` | no |
| <a name="input_repository_id"></a> [repository\_id](#input\_repository\_id) | Artifact Registry repository id, the same in every location. | `string` | `"f1v-repo"` | no |
| <a name="input_shared_secret_accessors"></a> [shared\_secret\_accessors](#input\_shared\_secret\_accessors) | Members granted roles/secretmanager.secretAccessor on every shared secret. | `list(string)` | `[]` | no |
| <a name="input_shared_secret_ids"></a> [shared\_secret\_ids](#input\_shared\_secret\_ids) | Secret containers shared by every environment. Values are added out of band so they never enter state. | `list(string)` | `[]` | no |
| <a name="input_state_bucket"></a> [state\_bucket](#input\_state\_bucket) | Name of the bucket root.hcl writes every unit's state into. | `string` | n/a | yes |
| <a name="input_state_bucket_location"></a> [state\_bucket\_location](#input\_state\_bucket\_location) | Location of the state bucket | `string` | `"us-central1"` | no |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_cloudbuild_repository_id"></a> [cloudbuild\_repository\_id](#output\_cloudbuild\_repository\_id) | Resource id of the 2nd-gen repository, for a trigger's repository\_event\_config. Empty while the connection is unmanaged (CPLX-8). |
| <a name="output_dns_zone_name"></a> [dns\_zone\_name](#output\_dns\_zone\_name) | Managed zone name the environment units add their records to. Empty when no zone is managed here. |
| <a name="output_planner_service_account"></a> [planner\_service\_account](#output\_planner\_service\_account) | Email the pull-request plan impersonates. |
| <a name="output_registry_hosts"></a> [registry\_hosts](#output\_registry\_hosts) | Registry host per entry in var.registries, e.g. us-central1-docker.pkg.dev. |
| <a name="output_repository_id"></a> [repository\_id](#output\_repository\_id) | Artifact Registry repository id. |
| <a name="output_shared_secret_ids"></a> [shared\_secret\_ids](#output\_shared\_secret\_ids) | The shared secret containers, keyed by id. |
| <a name="output_wif_provider"></a> [wif\_provider](#output\_wif\_provider) | Full resource name of the OIDC provider, for google-github-actions/auth. |
<!-- END_TF_DOCS -->
