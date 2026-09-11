# `redis` — Live telemetry cache and replay state

One Memorystore instance per environment on Redis 7.2, with AUTH and in-transit
encryption.

Both credentials it needs are delivered through Secret Manager rather than
inputs: the AUTH string, which GCP generates (S2), and the CA chain the services
must trust — which was enabled but never delivered, so the handshake could only
fail (REL-3). Persistence is deliberately off; everything here is rebuildable
from BigQuery or OpenF1.

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
| [google_redis_instance.f1v_cache](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/redis_instance) | resource |
| [google_secret_manager_secret.redis_auth](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret) | resource |
| [google_secret_manager_secret.redis_ca](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret) | resource |
| [google_secret_manager_secret_iam_member.auth_accessors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret_iam_member) | resource |
| [google_secret_manager_secret_iam_member.ca_accessors](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret_iam_member) | resource |
| [google_secret_manager_secret_version.redis_auth](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret_version) | resource |
| [google_secret_manager_secret_version.redis_ca](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret_version) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_auth_secret_accessors"></a> [auth\_secret\_accessors](#input\_auth\_secret\_accessors) | Members granted roles/secretmanager.secretAccessor on this instance's AUTH secret, as fully-qualified IAM members. | `list(string)` | `[]` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | Environment (dev, uat, prod) | `string` | n/a | yes |
| <a name="input_maintenance_window_hour_utc"></a> [maintenance\_window\_hour\_utc](#input\_maintenance\_window\_hour\_utc) | Hour (UTC) of the Sunday maintenance window. | `number` | `5` | no |
| <a name="input_memory_size_gb"></a> [memory\_size\_gb](#input\_memory\_size\_gb) | Instance capacity in GiB. The live feed and replay buffers are the working set; this is not a durable store. | `number` | `1` | no |
| <a name="input_network_id"></a> [network\_id](#input\_network\_id) | The VPC Network ID to connect Redis to | `string` | n/a | yes |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | GCP Region | `string` | n/a | yes |
| <a name="input_tier"></a> [tier](#input\_tier) | Memorystore service tier. STANDARD\_HA gives a replica and automatic failover; BASIC is a single node with no failover. | `string` | `"BASIC"` | no |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_redis_auth_secret_id"></a> [redis\_auth\_secret\_id](#output\_redis\_auth\_secret\_id) | Secret Manager secret holding the Memorystore AUTH string. Mount it as SPRING\_DATA\_REDIS\_PASSWORD. |
| <a name="output_redis_ca_secret_id"></a> [redis\_ca\_secret\_id](#output\_redis\_ca\_secret\_id) | Secret holding the instance's CA certificate chain in PEM form. Mount it as F1V\_REDIS\_CA\_CERT; the services trust it through a Spring SSL bundle (REL-3). |
| <a name="output_redis_host"></a> [redis\_host](#output\_redis\_host) | Private IP of the Memorystore instance, mounted as SPRING\_DATA\_REDIS\_HOST. |
| <a name="output_redis_port"></a> [redis\_port](#output\_redis\_port) | Port of the Memorystore instance, mounted as SPRING\_DATA\_REDIS\_PORT. |
<!-- END_TF_DOCS -->
