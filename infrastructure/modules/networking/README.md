# `networking` — VPC, subnet and firewall

One VPC per environment, one subnet, and one firewall rule allowing TCP 6379
from that subnet to Memorystore.

The Serverless VPC Access connector is gone: Cloud Run attaches to the subnet
directly (PERF-1), which removes a fixed monthly cost and a shared bandwidth
ceiling on the Redis fan-out path.

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
| [google_compute_firewall.allow_redis_from_services](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_firewall) | resource |
| [google_compute_network.f1v_vpc](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_network) | resource |
| [google_compute_subnetwork.f1v_subnet](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_subnetwork) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_network_name"></a> [network\_name](#input\_network\_name) | The name of the VPC network | `string` | n/a | yes |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | The GCP region for the subnets | `string` | n/a | yes |
| <a name="input_subnet_cidr"></a> [subnet\_cidr](#input\_subnet\_cidr) | IP CIDR range for the subnet Cloud Run attaches to with direct VPC egress | `string` | `"10.0.0.0/24"` | no |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_network_id"></a> [network\_id](#output\_network\_id) | The ID of the VPC Network |
| <a name="output_network_name"></a> [network\_name](#output\_network\_name) | The Name of the VPC Network |
| <a name="output_subnetwork_id"></a> [subnetwork\_id](#output\_subnetwork\_id) | The ID of the primary Subnet |
| <a name="output_subnetwork_name"></a> [subnetwork\_name](#output\_subnetwork\_name) | Name of the subnet Cloud Run attaches to with direct VPC egress |
<!-- END_TF_DOCS -->
