# `cloudbuild-triggers` — Build and deploy triggers

Seven triggers: one per backend service from a single shared pipeline
definition, one for the frontend, one for infrastructure.

The infrastructure trigger runs as a different identity from the others (SEC-1)
and requires manual approval in prod (REL-5). The other six execute third-party
build code and hold no IAM or network administration at all.

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
| [google_cloudbuild_trigger.backend](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuild_trigger) | resource |
| [google_cloudbuild_trigger.frontend](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuild_trigger) | resource |
| [google_cloudbuild_trigger.infrastructure](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuild_trigger) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_branch_pattern"></a> [branch\_pattern](#input\_branch\_pattern) | Regex the pushed branch must match. One branch per environment: ^dev$, ^uat$, ^prod$. | `string` | `"^main$"` | no |
| <a name="input_cloudbuild_repository_id"></a> [cloudbuild\_repository\_id](#input\_cloudbuild\_repository\_id) | 2nd-gen google\_cloudbuildv2\_repository id. Empty keeps the 1st-gen github block, whose connection is console state (CPLX-8). | `string` | `""` | no |
| <a name="input_deploy_service_account_email"></a> [deploy\_service\_account\_email](#input\_deploy\_service\_account\_email) | Identity the backend and frontend triggers run as. Runs third-party build code; holds no IAM or network administration. | `string` | n/a | yes |
| <a name="input_environment"></a> [environment](#input\_environment) | Environment name (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_github_owner"></a> [github\_owner](#input\_github\_owner) | GitHub repository owner (user or organization) | `string` | n/a | yes |
| <a name="input_github_repo"></a> [github\_repo](#input\_github\_repo) | GitHub repository name | `string` | n/a | yes |
| <a name="input_infra_service_account_email"></a> [infra\_service\_account\_email](#input\_infra\_service\_account\_email) | Identity the infrastructure trigger runs as. Runs only code from this repository. | `string` | n/a | yes |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | GCP Region for Cloud Build triggers | `string` | n/a | yes |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_trigger_ids"></a> [trigger\_ids](#output\_trigger\_ids) | Map of trigger names to their Cloud Build trigger IDs |
<!-- END_TF_DOCS -->
