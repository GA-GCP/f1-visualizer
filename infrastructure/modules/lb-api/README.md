# `lb-api` — The API edge

A global external load balancer routing `/api/v1/{users,analysis,ingestion}` and
`/ws` straight to Cloud Run. It used to front an API Gateway over the public
internet, which duplicated JWT validation the services already did and added two
TLS terminations to every REST call (CPLX-1, PERF-3).

Every path rule carries its own `cors_policy`: answering OPTIONS at the edge is
what removed a documented preflight cascade, and `cors_policy` does not inherit
into a path rule. Cloud Armor throttles and runs preconfigured WAF rules (SEC-4);
request logging is on (OPS-2); the analysis backend has Cloud CDN in front of the
reference endpoints the origin marks public (PERF-7).

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
| [google_certificate_manager_certificate.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/certificate_manager_certificate) | resource |
| [google_certificate_manager_certificate_map.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/certificate_manager_certificate_map) | resource |
| [google_certificate_manager_certificate_map_entry.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/certificate_manager_certificate_map_entry) | resource |
| [google_certificate_manager_dns_authorization.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/certificate_manager_dns_authorization) | resource |
| [google_compute_backend_service.rest](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_backend_service) | resource |
| [google_compute_backend_service.telemetry_backend](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_backend_service) | resource |
| [google_compute_global_address.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_address) | resource |
| [google_compute_global_address.ipv6](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_address) | resource |
| [google_compute_global_forwarding_rule.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_forwarding_rule) | resource |
| [google_compute_global_forwarding_rule.http](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_forwarding_rule) | resource |
| [google_compute_global_forwarding_rule.http_ipv6](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_forwarding_rule) | resource |
| [google_compute_global_forwarding_rule.https_ipv6](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_global_forwarding_rule) | resource |
| [google_compute_managed_ssl_certificate.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_managed_ssl_certificate) | resource |
| [google_compute_region_network_endpoint_group.rest_neg](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_region_network_endpoint_group) | resource |
| [google_compute_region_network_endpoint_group.telemetry_neg](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_region_network_endpoint_group) | resource |
| [google_compute_security_policy.api](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_security_policy) | resource |
| [google_compute_ssl_policy.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_ssl_policy) | resource |
| [google_compute_target_http_proxy.redirect](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_target_http_proxy) | resource |
| [google_compute_target_https_proxy.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_target_https_proxy) | resource |
| [google_compute_url_map.default](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_url_map) | resource |
| [google_compute_url_map.https_redirect](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_url_map) | resource |
| [google_dns_record_set.a](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set) | resource |
| [google_dns_record_set.aaaa](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set) | resource |
| [google_dns_record_set.dns_auth](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_analysis_service_name"></a> [analysis\_service\_name](#input\_analysis\_service\_name) | Cloud Run service name serving /api/v1/analysis | `string` | n/a | yes |
| <a name="input_dns_zone_name"></a> [dns\_zone\_name](#input\_dns\_zone\_name) | Cloud DNS managed zone this edge adds its records to, from the platform layer. Empty means DNS is managed elsewhere and no records or Certificate Manager resources are created. | `string` | `""` | no |
| <a name="input_domain"></a> [domain](#input\_domain) | Domain the managed certificate is issued for (e.g. dev.api.f1visualizer.com) | `string` | n/a | yes |
| <a name="input_enable_adaptive_protection"></a> [enable\_adaptive\_protection](#input\_enable\_adaptive\_protection) | Cloud Armor Adaptive Protection (layer 7 DDoS defence). Requires Cloud Armor Enterprise, which is billed separately. | `bool` | `false` | no |
| <a name="input_frontend_origin"></a> [frontend\_origin](#input\_frontend\_origin) | Origin allowed by the edge CORS policy (e.g. https://dev.f1visualizer.com) | `string` | n/a | yes |
| <a name="input_ingestion_service_name"></a> [ingestion\_service\_name](#input\_ingestion\_service\_name) | Cloud Run service name serving /api/v1/ingestion | `string` | n/a | yes |
| <a name="input_name_prefix"></a> [name\_prefix](#input\_name\_prefix) | Prefix for every resource this module creates (e.g. f1v-api-dev) | `string` | n/a | yes |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | GCP region of the Cloud Run services the serverless NEGs point at. Must match the services' own region. | `string` | n/a | yes |
| <a name="input_telemetry_service_name"></a> [telemetry\_service\_name](#input\_telemetry\_service\_name) | Cloud Run service name serving the /ws WebSocket route | `string` | n/a | yes |
| <a name="input_use_certificate_manager"></a> [use\_certificate\_manager](#input\_use\_certificate\_manager) | Serve from the Certificate Manager map instead of the classic managed certificate. Flip only once the certificate reports ACTIVE (SEC-5). | `bool` | `false` | no |
| <a name="input_user_service_name"></a> [user\_service\_name](#input\_user\_service\_name) | Cloud Run service name serving /api/v1/users | `string` | n/a | yes |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_static_ip"></a> [static\_ip](#output\_static\_ip) | IPv4 address for the A record |
| <a name="output_static_ipv6"></a> [static\_ipv6](#output\_static\_ipv6) | IPv6 address for the AAAA record (SEC-5) |
<!-- END_TF_DOCS -->
