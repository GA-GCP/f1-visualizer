# `cloud-run` — Every Cloud Run service

One module for the five JVM services and the nginx frontend. It was two, and
they had drifted: the frontend copy had no service account, no labels and no
lifecycle rules, because each was added to the other one (CPLX-4).

`service_account_email` is required — leaving it unset is how the frontend came
to run as the default compute account with Editor (SEC-2). `ingress` defaults to
load-balancer-only, and `invokers` is one list that accepts `"allUsers"` for a
service fronted by a serverless NEG, which cannot present an ID token.

The image and traffic split are ignored by `lifecycle`: the pipeline owns those,
this module owns everything else. Without that, an infrastructure apply is also
an unreviewed application deploy (REL-1).

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
| [google_cloud_run_v2_service.service](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service) | resource |
| [google_cloud_run_v2_service_iam_member.invokers](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service_iam_member) | resource |

## Inputs

| Name | Description | Type | Default | Required |
| ---- | ----------- | ---- | ------- | :------: |
| <a name="input_container_concurrency"></a> [container\_concurrency](#input\_container\_concurrency) | Max concurrent requests per instance | `number` | `80` | no |
| <a name="input_container_port"></a> [container\_port](#input\_container\_port) | Port the container listens on. 8080 for the Spring services; nginx.conf also listens on 8080. | `number` | `8080` | no |
| <a name="input_cpu"></a> [cpu](#input\_cpu) | CPU limit (e.g. '1000m' = 1 vCPU, '2000m' = 2 vCPUs) | `string` | `"1000m"` | no |
| <a name="input_cpu_idle"></a> [cpu\_idle](#input\_cpu\_idle) | true = CPU is throttled between requests (Cloud Run's default). Set false for services that do work off the request thread — the replay tick, MQTT callbacks, the Redis subscriber. | `bool` | `true` | no |
| <a name="input_deletion_protection"></a> [deletion\_protection](#input\_deletion\_protection) | Prevent the service from being destroyed | `bool` | `false` | no |
| <a name="input_env_vars"></a> [env\_vars](#input\_env\_vars) | Environment variables (Key=Value) | `map(string)` | `{}` | no |
| <a name="input_execution_environment"></a> [execution\_environment](#input\_execution\_environment) | Cloud Run execution environment. GEN2 gives a full Linux kernel and is required for direct VPC egress. | `string` | `"EXECUTION_ENVIRONMENT_GEN2"` | no |
| <a name="input_image_url"></a> [image\_url](#input\_image\_url) | Docker image URL (e.g., us-central1-docker.pkg.dev/...) | `string` | n/a | yes |
| <a name="input_ingress"></a> [ingress](#input\_ingress) | Which callers may reach the service directly. INGRESS\_TRAFFIC\_INTERNAL\_LOAD\_BALANCER keeps the *.run.app URL from answering the internet. | `string` | `"INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"` | no |
| <a name="input_invokers"></a> [invokers](#input\_invokers) | Members granted roles/run.invoker. Accepts "allUsers" for a service fronted by a serverless NEG, which cannot present an ID token. | `list(string)` | `[]` | no |
| <a name="input_liveness_probe"></a> [liveness\_probe](#input\_liveness\_probe) | Liveness probe. Restarts an instance that is alive as a process but no longer serving. | <pre>object({<br/>    path                  = optional(string, "/actuator/health/liveness")<br/>    initial_delay_seconds = optional(number, 30)<br/>    period_seconds        = optional(number, 30)<br/>    timeout_seconds       = optional(number, 5)<br/>    failure_threshold     = optional(number, 3)<br/>  })</pre> | `{}` | no |
| <a name="input_max_instance_count"></a> [max\_instance\_count](#input\_max\_instance\_count) | Maximum number of instances to scale up to | `number` | `5` | no |
| <a name="input_memory"></a> [memory](#input\_memory) | Memory limit (e.g. '256Mi', '1024Mi', '2Gi') | `string` | `"512Mi"` | no |
| <a name="input_min_instance_count"></a> [min\_instance\_count](#input\_min\_instance\_count) | Minimum number of instances to keep warm (0 = scale to zero, 1+ = always-on) | `number` | `0` | no |
| <a name="input_project_id"></a> [project\_id](#input\_project\_id) | The GCP Project ID | `string` | n/a | yes |
| <a name="input_region"></a> [region](#input\_region) | GCP Region | `string` | n/a | yes |
| <a name="input_secret_env_vars"></a> [secret\_env\_vars](#input\_secret\_env\_vars) | Environment variables sourced from Secret Manager, as env var name => { secret, version }.<br/>The service account needs roles/secretmanager.secretAccessor on each secret.<br/>`version` defaults to "latest"; pin it for credentials that should only change<br/>through a deliberate deploy, and leave it on "latest" for values GCP rotates<br/>for us (the Memorystore AUTH string). | <pre>map(object({<br/>    secret  = string<br/>    version = optional(string, "latest")<br/>  }))</pre> | `{}` | no |
| <a name="input_service_account_email"></a> [service\_account\_email](#input\_service\_account\_email) | Identity the service runs as. Required: leaving it unset falls back to the default compute service account. | `string` | n/a | yes |
| <a name="input_service_name"></a> [service\_name](#input\_service\_name) | GCP CloudRun service name | `string` | n/a | yes |
| <a name="input_startup_probe"></a> [startup\_probe](#input\_startup\_probe) | Startup probe. The default is Actuator's readiness group with a 150s budget, which is generous for a JVM cold start with CPU boost. | <pre>object({<br/>    path                  = optional(string, "/actuator/health/readiness")<br/>    initial_delay_seconds = optional(number, 10)<br/>    period_seconds        = optional(number, 5)<br/>    timeout_seconds       = optional(number, 5)<br/>    failure_threshold     = optional(number, 30)<br/>  })</pre> | `{}` | no |
| <a name="input_timeout"></a> [timeout](#input\_timeout) | Maximum request duration (e.g., '300s', '3600s'). Defaults to Cloud Run's 300s. | `string` | `null` | no |
| <a name="input_vpc_network"></a> [vpc\_network](#input\_vpc\_network) | VPC network name for direct egress. Null for services with no private dependency. | `string` | `null` | no |
| <a name="input_vpc_subnetwork"></a> [vpc\_subnetwork](#input\_vpc\_subnetwork) | Subnet name the instance takes an address on. Required when vpc\_network is set. | `string` | `null` | no |

## Outputs

| Name | Description |
| ---- | ----------- |
| <a name="output_service_name"></a> [service\_name](#output\_service\_name) | Service name, used by the load-balancer units to build their serverless NEGs. |
| <a name="output_service_url"></a> [service\_url](#output\_service\_url) | The service's *.run.app URL. Not the public entry point — that is the load balancer. |
<!-- END_TF_DOCS -->
