# F1V Infrastructure Audit

Repository `GA-GCP/f1-visualizer`, commit `d901495` (2026-09-08), reviewed 2026-09-09.

Companion to the backend architecture review of 2026-09-08. Finding IDs here are prefixed SEC, REL, PERF, CPLX, DLV and OPS so they never collide with that review's S/R/P/C/T/O IDs, which appear in code comments.

51 findings. 2 critical, 14 high, 20 medium, 15 low. Effort S is under a day, M a sprint task, L structural.

## Fix first

1. **REL-1** (Critical) — A prod infrastructure apply can deploy a dev-built image to prod. One lifecycle block and an env-suffixed tag close it.
2. **SEC-1** (Critical) — One identity with project IAM admin runs every pipeline, including the ones that execute npm and Maven scripts.
3. **REL-3** (High) — Redis TLS is on but the services are never given Memorystore's CA; either they cannot connect or verification is off.
4. **REL-2** (High) — The UAT replay worker is declared in the wrong region; it cannot be applied or deployed.
5. **SEC-2** (High) — The public nginx container runs as the default compute service account.
6. **REL-5** (High) — Prod applies with no approval and no saved plan.
7. **CPLX-1** (High) — Retiring the API Gateway removes a pipeline, a beta provider, a bootstrap hack and a public hop.
8. **CPLX-3** (High) — Forty-eight near-identical unit files; derive environment facts once.
9. **PERF-1** (High) — Direct VPC egress replaces three always-on connectors.
10. **OPS-1** (High) — There is no monitoring, alerting or budget in IaC.

## Findings

### Security posture (SEC)

#### SEC-1 · Critical · effort M — One over-privileged CI identity per environment runs both the app pipelines and the infrastructure pipeline

**Where**

- `infrastructure/modules/iam-and-secrets/main.tf:58-77`
- `infrastructure/modules/iam-and-secrets/main.tf:185-219`
- `infrastructure/modules/cloudbuild-triggers/main.tf:87`
- `infrastructure/modules/cloudbuild-triggers/main.tf:120`
- `infrastructure/modules/cloudbuild-triggers/main.tf:156`
- `infrastructure/modules/cloudbuild-triggers/main.tf:193`

**Evidence**

`sa-f1v-cloudbuild-<env>` holds, at **project** level: `roles/resourcemanager.projectIamAdmin`, `roles/iam.serviceAccountUser`, `roles/run.admin`, `roles/bigquery.admin`, `roles/datastore.owner`, `roles/redis.admin`, `roles/compute.networkAdmin`, `roles/compute.loadBalancerAdmin`, `roles/vpcaccess.admin`, `roles/apigateway.admin`, `roles/artifactregistry.writer` and `roles/cloudbuild.builds.builder`. The same account is the `service_account` of all eight triggers, including the backend and frontend pipelines that execute third-party code on every push (`./mvnw verify`, `yarn install` with lifecycle scripts). Trivy flags the project-level `serviceAccountUser` grant as GCP-0011.

**Why it matters**

A single malicious or compromised dependency running inside a **dev** build can use the metadata-server token to grant itself `roles/owner` (projectIamAdmin), read every secret, and reach prod Firestore, Redis and BigQuery, because all three environments share one project. This is the widest blast radius in the estate and it is reachable from the least-trusted code path.

**Fix**

- Split identities: `sa-f1v-deploy-<env>` for the backend, frontend and gateway pipelines with `roles/run.developer`, `roles/artifactregistry.writer` **on the repository**, `roles/run.viewer`, and `roles/iam.serviceAccountUser` granted per runtime service account (`google_service_account_iam_member`), not on the project; `roles/apigateway.admin` only if the gateway pipeline survives CPLX-1.
- `sa-f1v-infra-<env>` for `cloudbuild/infrastructure.yaml` only. Replace `projectIamAdmin` with `roles/iam.serviceAccountAdmin` plus the resource-level bindings the modules actually create; if project bindings must stay, add an IAM condition that limits the grantable roles.
- Medium term: one GCP project per environment under a folder, with a small platform project for Artifact Registry and state (see CPLX-2). Environment isolation cannot be recovered with IAM alone while everything shares a project.

#### SEC-2 · High · effort S — The frontend Cloud Run service runs as the default compute service account

**Where**

- `infrastructure/modules/cloud-run-frontend/main.tf:1-62`
- `infrastructure/modules/iam-and-secrets/main.tf:47-51`
- `infrastructure/environments/dev/f1v-webapp/terragrunt.hcl`
- `README.md:592-596`

**Evidence**

The frontend module never sets `template.service_account`, so Cloud Run falls back to `<project-number>-compute@developer.gserviceaccount.com`. The `sa-f1v-frontend-<env>` account created in `iam-and-secrets` (with the comment "gets ZERO bindings, effectively isolating it completely") is not referenced anywhere. The README claims the frontend has zero permissions.

**Why it matters**

Unless the org policy `iam.automaticIamGrantsForDefaultServiceAccounts` is enforced, the default compute account carries `roles/editor` on the project. The internet-facing nginx container therefore runs with more privilege than any backend service.

**Fix**

Add `service_account_email` to the frontend module (required, no default), add a `dependency "iam"` block to the three `f1v-webapp` units and pass `dependency.iam.outputs.sa_frontend_email`. Then enforce the org policy so the default account is never granted Editor again.

**Verify**

Whether the default compute account still holds Editor depends on org policy; check `gcloud projects get-iam-policy f1v-example-project`.

#### SEC-3 · High · effort M — Project-wide data and secret roles let every environment's runtime identity reach every other environment's data

**Where**

- `infrastructure/modules/iam-and-secrets/main.tf:80-99`
- `infrastructure/modules/iam-and-secrets/main.tf:103-107`
- `infrastructure/modules/iam-and-secrets/main.tf:112-126`
- `infrastructure/modules/iam-and-secrets/main.tf:131-164`

**Evidence**

`roles/secretmanager.secretAccessor`, `roles/datastore.user`, `roles/bigquery.dataEditor` and `roles/bigquery.dataViewer` are all bound with `google_project_iam_member`. Because dev, uat and prod live in one project, `sa-f1v-data-ingestion-dev` can read `f1v-redis-auth-prod`, `sa-f1v-user-dev` can write to `f1v-db-prod`, and every BigQuery identity can read every dataset.

**Why it matters**

Environment boundaries exist in naming only. A bug or compromise in dev has prod reach, and the audit trail cannot tell an intended access from an unintended one.

**Fix**

- Secrets: `google_secret_manager_secret_iam_member` on each secret for the one or two accounts that consume it.
- BigQuery: `google_bigquery_dataset_iam_member` on the dataset, after CPLX-2 gives each environment its own dataset.
- Firestore: an IAM condition on the binding (`resource.name` matching `projects/f1v-example-project/databases/f1v-db-<env>`), or per-environment projects.
- Keep `roles/bigquery.jobUser` at project level; it is the one role that genuinely is project-scoped.

#### SEC-4 · Medium · effort M — No Cloud Armor policy on either load balancer

**Where**

- `infrastructure/modules/lb-api/main.tf:46-80`
- `infrastructure/modules/lb-frontend/main.tf:19-35`
- `README.md:508-514`

**Evidence**

No `google_compute_security_policy` exists and no backend service sets `security_policy`. The README documents client-side retry logic built specifically to survive 429 cascades, which is the symptom of having no edge rate limiting.

**Why it matters**

Anyone can drive request volume straight at the gateway and the WebSocket backend; the only protection is Cloud Run autoscaling, which converts abuse into a bill. There is no WAF layer in front of a public API.

**Fix**

One policy per load balancer: a throttle rule (for example 300 requests per minute per client IP on `/api/*`, a lower ceiling on `/ws/*` handshakes), Google's preconfigured WAF rules at sensitivity 1, and adaptive protection. Attach with `security_policy` on the frontend, telemetry and API backend services.

**Verify**

Confirm in current docs that Cloud Armor can be attached to the internet-NEG backend; the serverless-NEG backends are supported.

#### SEC-5 · Medium · effort M — TLS and edge posture: no SSL policy, classic managed certificates, no HTTP redirect, no IPv6

**Where**

- `infrastructure/modules/lb-api/main.tf:129-154`
- `infrastructure/modules/lb-frontend/main.tf:45-70`

**Evidence**

Both target HTTPS proxies use the default SSL policy (TLS 1.0 permitted, COMPATIBLE profile). Certificates are `google_compute_managed_ssl_certificate`, the classic type. Only a port-443 forwarding rule exists, so `http://f1visualizer.com` refuses the connection instead of redirecting; nginx sets HSTS, which only helps after a first HTTPS visit. Both addresses are IPv4 only.

**Why it matters**

A scanner will report weak TLS on a public API; typed or legacy `http://` links fail rather than upgrade; IPv6-only clients cannot connect.

**Fix**

- `google_compute_ssl_policy` with `min_tls_version = "TLS_1_2"` and `profile = "MODERN"` (or RESTRICTED), referenced by both proxies.
- Certificate Manager (`google_certificate_manager_certificate` with DNS authorization, a certificate map on the proxy). It also allows one certificate for `f1visualizer.com` and `www`.
- A second URL map with `default_url_redirect { https_redirect = true }`, a `google_compute_target_http_proxy` and a port-80 forwarding rule.
- An `ip_version = "IPV6"` global address and forwarding rule per load balancer.

#### SEC-6 · Medium · effort S — Secrets are half-managed: the module named iam-and-secrets manages none, and the OpenF1 credentials are shared by all environments at `latest`

**Where**

- `infrastructure/modules/iam-and-secrets/main.tf`
- `infrastructure/environments/dev/f1v-service-data-ingestion/terragrunt.hcl:84-91`
- `infrastructure/environments/prod/f1v-service-replay-worker/terragrunt.hcl:82-88`

**Evidence**

`f1v-api-openf1-login-user-email` and `f1v-api-openf1-login-user-password` are referenced by six units but created out of band; they carry no environment suffix, so dev, uat and prod share one credential. Every reference tracks version `latest` with a `TODO: pin` comment. The Redis AUTH secret is the only secret the code manages.

**Why it matters**

Rotating the OpenF1 password rotates it for prod and dev in the same instant, and nothing in IaC records which secrets must exist for a fresh environment to start.

**Fix**

Declare the secret containers in IaC (a `secrets` module or the platform layer), add versions out of band or with `secret_data_wo` so the value never enters state, grant `secretAccessor` per secret (SEC-3), and expose the pinned version as a Terragrunt input in `env.hcl` so a rotation is a reviewed change.

#### SEC-7 · Medium · effort S — State holds the Memorystore AUTH string in clear text, in a bucket that IaC does not manage

**Where**

- `infrastructure/root.hcl:5-20`
- `infrastructure/modules/redis/main.tf:46-49`

**Evidence**

`google_redis_instance.auth_string` and `google_secret_manager_secret_version.secret_data` both land in `environments/<env>/redis/terraform.tfstate`. The bucket `f1v-example-project-tfstate` is created outside IaC; its versioning, uniform bucket-level access, public-access prevention, retention and IAM are unknown from the repository.

**Why it matters**

Anyone with `storage.objects.get` on the bucket can read the Redis credential for every environment. Without versioning, a corrupted or force-pushed state cannot be recovered.

**Fix**

A bootstrap unit that owns the bucket: versioning on, uniform bucket-level access, `public_access_prevention = "enforced"`, soft-delete or retention, IAM limited to the infra identity and named admins. Use `secret_data_wo` (available in provider 8.2) for the secret version so at least one copy stays out of state, and consider a separate prod state bucket.

**Verify**

Bucket settings can be checked with `gcloud storage buckets describe gs://f1v-example-project-tfstate`.

#### SEC-8 · Low · effort S — Dead Pub/Sub grants and an over-broad builder role

**Where**

- `infrastructure/modules/iam-and-secrets/main.tf:85-89`
- `infrastructure/modules/iam-and-secrets/main.tf:136-140`
- `infrastructure/modules/iam-and-secrets/main.tf:73-77`
- `README.md:592-596`

**Evidence**

`roles/pubsub.publisher` (ingestion) and `roles/pubsub.subscriber` (telemetry) are granted, but no backend module depends on Pub/Sub; messaging is Redis pub/sub and streams (`f1v-commons-messaging`). The README's "Telemetry: Redis subscribe only" is wrong in the other direction (it also holds `secretAccessor`). `roles/cloudbuild.builds.builder` is the broad legacy role; with a user-specified service account and `CLOUD_LOGGING_ONLY`, `roles/logging.logWriter` is the documented minimum.

**Why it matters**

Unused grants are permanent attack surface and make the IAM policy unreadable as a statement of intent.

**Fix**

Delete the two Pub/Sub bindings. Replace `builds.builder` with `logging.logWriter` on the deploy identity and re-run one build of each pipeline to confirm nothing else was relying on it.

**Verify**

Do the builder-role swap on dev first; the exact minimum depends on which source fetch path the triggers use.

#### SEC-9 · Low · effort S — Enable the security plumbing that only exists at project level: audit logs, org policies, Binary Authorization

**Where**

- `infrastructure/root.hcl`
- `infrastructure/modules/cloud-run-backend/main.tf`

**Evidence**

Nothing in the repository enables Data Access audit logs for Secret Manager, Firestore or BigQuery (`google_project_iam_audit_config`), sets org policies (`iam.disableServiceAccountKeyCreation`, `iam.automaticIamGrantsForDefaultServiceAccounts`, `run.allowedIngress`), or configures Binary Authorization although every image is already scanned before deploy.

**Why it matters**

Secret reads and Firestore writes are not in the audit trail; a leaked service-account key cannot be ruled out by policy; a hand-deployed unscanned image is indistinguishable from a pipeline one.

**Fix**

Add these to the platform layer (OPS-3). Binary Authorization can start in dry-run with an attestation produced after the Trivy step, then move to enforce for prod only.

**Verify**

Org policies need an organization resource; if the project is standalone, note that as an accepted gap.

#### SEC-10 · Low · effort S — The frontend keeps a second public origin on `*.run.app`

**Where**

- `infrastructure/modules/cloud-run-frontend/main.tf:5`
- `infrastructure/modules/cloud-run-frontend/main.tf:65-72`
- `frontend/nginx.conf:26-29`

**Evidence**

`ingress = "INGRESS_TRAFFIC_ALL"` plus `allUsers` means the SPA answers on its Cloud Run URL as well as on the load balancer domain; nginx carries three CSP branches just for those hosts. The backend services already use `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`.

**Why it matters**

Cloud Armor, CDN and the custom domain can be bypassed for the static site; the duplicate origin also complicates CSP and analytics.

**Fix**

Restrict ingress to the load balancer once the pipeline smoke test (which uses the revision tag URL) is moved behind the LB, for example by routing a header-selected tag through the URL map, or by accepting that the smoke test runs against the previous revision's LB URL after promotion. Low priority; document the trade-off if the tag URL stays.

### Reliability and correctness (REL)

#### REL-1 · Critical · effort S — Any prod infrastructure apply can roll the backend services onto whatever image was built last, including a dev build

**Where**

- `infrastructure/modules/cloud-run-backend/main.tf:1-106`
- `infrastructure/environments/prod/f1v-service-user/terragrunt.hcl:22`
- `infrastructure/environments/prod/f1v-service-data-analysis/terragrunt.hcl:22`
- `cloudbuild/backend-service.yaml:90-103`
- `cloudbuild/backend-service.yaml:106-117`

**Evidence**

Three facts combine. First, `cloudbuild/backend-service.yaml` pushes every backend image as `<region>-docker.pkg.dev/<project>/f1v-repo/<image>:latest` as well as `:<sha>`; dev and prod both use `us-central1`, so they share one `f1v-repo` and one `:latest` tag per service (the frontend was given `latest-<env>` in 28c004b; the backend was not). Second, every prod unit sets `image_url = "...:latest"`. Third, the module has no `lifecycle { ignore_changes }`, while the deploy step updates the live service to `:<sha>` with `gcloud run services update`. On the next apply the provider sees `:<sha>` in the refreshed state and `:latest` in configuration, creates a new revision from `:latest`, and, because the v2 API sends absent `traffic` as "100% to latest", routes all traffic to it. The prod infrastructure trigger fires on any push to `prod` that touches `infrastructure/**`.

**Why it matters**

A routine infrastructure change in prod is also an unreviewed application deploy of an image nobody chose, possibly one built from the `dev` branch. It also explains the "reverting" behaviour the api-gateway module comments describe; the same mechanism applies to Cloud Run.

**Fix**

- In both Cloud Run modules: `lifecycle { ignore_changes = [template[0].containers[0].image, traffic, client, client_version] }`. The pipeline owns the image and traffic; IaC owns everything else. `client` and `client_version` are optional, non-computed attributes that gcloud sets on every deploy, so they would otherwise produce a `"gcloud" -> null` diff on every plan.
- Tag backend images `latest-${_ENV}` like the frontend, or stop using floating tags in IaC at all and bootstrap with the SHA that is live.
- Remove the half-implemented `get_env("TF_VAR_image_url", ...)` in the six ingestion and replay-worker units; nothing sets it and it makes two of five services behave differently for no reason.

**Verify**

Run `terragrunt plan` in prod after a pipeline deploy; the plan should show the image and client diffs described here.

#### REL-2 · High · effort S — The UAT replay worker is defined in us-central1 while every other UAT resource is in us-east1

**Where**

- `infrastructure/environments/uat/f1v-service-replay-worker/terragrunt.hcl:16-21`
- `infrastructure/environments/uat/f1v-service-replay-worker/terragrunt.hcl:46`
- `infrastructure/environments/uat/f1v-service-replay-worker/terragrunt.hcl:49`
- `infrastructure/environments/uat/cloudbuild-triggers/terragrunt.hcl:18`
- `infrastructure/environments/uat/networking/terragrunt.hcl:15`

**Evidence**

UAT moved to us-east1 on 2026-03-10 (ce7549e). The replay worker unit added on 2026-09-08 was copied from dev: `region = "us-central1"`, image `us-central1-docker.pkg.dev/.../replay-worker:latest`, and a networking mock pointing at a us-central1 connector. The real connector, Redis instance and registry are in us-east1, and the UAT backend trigger deploys with `_REGION = us-east1`.

**Why it matters**

A Cloud Run service must use a VPC connector in its own region, so the apply fails; if it were created it could not reach the us-east1 Redis, and the UAT pipeline's `gcloud run services update f1v-service-replay-worker-uat --region=us-east1` targets a service that does not exist. UAT has no replay worker.

**Fix**

Set `region = "us-east1"`, use the us-east1 registry path, fix the mock. CPLX-3 removes the class of error by deriving region and registry from one `env.hcl`.

#### REL-3 · High · effort M — Memorystore in-transit encryption is enabled, but the services are never given the CA they must trust

**Where**

- `infrastructure/modules/redis/main.tf:15-16`
- `infrastructure/modules/redis/outputs.tf`
- `backend/f1v-service-telemetry/src/main/resources/application.yml:15-19`
- `backend/f1v-service-data-ingestion/src/main/resources/application.yml:21-25`

**Evidence**

`transit_encryption_mode = "SERVER_AUTHENTICATION"` makes Memorystore present a certificate issued by its own per-instance CA, which the client must install. The application sets `spring.data.redis.ssl.enabled: true` with no SSL bundle or truststore, so Lettuce verifies against the JVM default store. The redis module does not output `server_ca_certs`, and no unit mounts a CA file or environment variable.

**Why it matters**

Expected behaviour is a handshake failure (`PKIX path building failed`) on the first Redis call, which means the readiness probe never passes and the telemetry, ingestion and replay-worker revisions never become healthy. If those services are up today, something is disabling peer verification, which would make the encryption bypassable.

**Fix**

Output `google_redis_instance.f1v_cache.server_ca_certs[*].cert`, store the concatenated PEM in a Secret Manager secret next to the AUTH string, mount it as an environment variable or file, and configure a Spring SSL bundle: `spring.ssl.bundle.pem.redis.truststore.certificate` plus `spring.data.redis.ssl.bundle: redis`. Include every certificate in the list, since Memorystore rotates the CA.

**Verify**

Check the Cloud Run logs of any service with SPRING_DATA_REDIS_HOST set; the answer is one startup log away.

#### REL-4 · High · effort S — The infrastructure pipeline identity cannot manage several of the resources the code declares

**Where**

- `infrastructure/modules/iam-and-secrets/main.tf:185-219`
- `infrastructure/modules/networking/main.tf:32-59`
- `infrastructure/modules/redis/main.tf:33-49`
- `infrastructure/modules/iam-and-secrets/main.tf:6-51`
- `infrastructure/modules/artifact-registry/main.tf`
- `infrastructure/modules/cloudbuild-triggers/main.tf`

**Evidence**

`roles/compute.networkAdmin` is defined by Google as network administration "except for firewall rules and SSL certificates", yet the networking module creates two firewall rules. No role covers creating Secret Manager secrets (redis module), service accounts (`iam.serviceAccountAdmin`), the Artifact Registry repository (`artifactregistry.writer` cannot create repositories) or Cloud Build triggers (`cloudbuild.builds.editor`).

**Why it matters**

The pipeline works only while those resources never change; the first drift in a firewall rule or a new secret fails the prod apply mid-run, after other units have already been applied. It also proves that a human with Owner bootstrapped the estate, and that bootstrap is undocumented.

**Fix**

Grant the infra identity (after SEC-1) `roles/compute.securityAdmin`, `roles/secretmanager.admin`, `roles/iam.serviceAccountAdmin`, `roles/artifactregistry.admin` and `roles/cloudbuild.builds.editor`, scoped to the resources where the provider allows it. Write the bootstrap order down in `infrastructure/README.md` (state bucket, APIs, iam unit, GitHub connection).

**Verify**

Compare with the live policy: `gcloud projects get-iam-policy f1v-example-project --flatten=bindings --filter='bindings.members:sa-f1v-cloudbuild'`.

#### REL-5 · High · effort S — Prod applies with no approval and no plan-apply separation, contrary to the README

**Where**

- `infrastructure/modules/cloudbuild-triggers/main.tf:161-194`
- `cloudbuild/infrastructure.yaml:72-94`
- `README.md:640-644`

**Evidence**

`google_cloudbuild_trigger.infrastructure` has no `approval_config`; the README's branch table says prod "requires approval". The pipeline runs `terragrunt run --all -- plan` and then `apply -auto-approve`, which re-plans, so the apply can differ from the plan that was logged.

**Why it matters**

A merge to `prod` touching any file under `infrastructure/` applies within minutes with nobody looking at the plan, including destroys.

**Fix**

- `approval_config { approval_required = var.environment == "prod" }` on the infrastructure trigger (and arguably the backend and frontend triggers).
- `terragrunt run --all --out-dir /workspace/plans -- plan -out=tfplan` then `terragrunt run --all --out-dir /workspace/plans -- apply tfplan`, with `-detailed-exitcode` to skip the apply when nothing changed.
- A plan-only trigger for pull requests into the environment branches (DLV-1).

#### REL-6 · Medium · effort S — Ordering dependencies are expressed as name strings, so a fresh environment applies in the wrong order

**Where**

- `infrastructure/environments/dev/lb-api/terragrunt.hcl:22`
- `infrastructure/environments/dev/lb-frontend/terragrunt.hcl:14`
- `infrastructure/modules/cloudbuild-triggers/main.tf:87`
- `infrastructure/environments/dev/cloudbuild-triggers/terragrunt.hcl`

**Evidence**

`lb-api` names `f1v-service-telemetry-<env>` and `lb-frontend` names `f1v-webapp-<env>` for their serverless NEGs without a `dependency` or `dependencies` block; `cloudbuild-triggers` constructs the Cloud Build service-account email by convention rather than reading `sa_cloudbuild_email`. Terragrunt therefore sees no edge and may apply the load balancers before the services exist.

**Why it matters**

First bootstrap of an environment fails on the NEGs and triggers; subsequent runs succeed by accident of ordering, which hides the problem until the next new environment.

**Fix**

Add `dependency "telemetry" { config_path = "../f1v-service-telemetry" }` and use `outputs.service_name`; same for the webapp; pass `dependency.iam.outputs.sa_cloudbuild_email` into the triggers module.

#### REL-7 · Medium · effort S — Mock outputs are allowed for every command, so an apply can use MOCK values

**Where**

- `infrastructure/environments/dev/f1v-service-telemetry/terragrunt.hcl:26-33`
- `infrastructure/environments/prod/redis/terragrunt.hcl:16-18`

**Evidence**

There are 42 `mock_outputs` blocks; none sets `mock_outputs_allowed_terraform_commands`. Terragrunt substitutes mocks whenever a dependency's state has no outputs, for any command.

**Why it matters**

If the redis unit's state is empty or its outputs are renamed, the telemetry unit applies with `SPRING_DATA_REDIS_HOST = 10.0.0.5` and a secret reference to `f1v-redis-auth-MOCK`, and the deploy fails at runtime rather than at plan.

**Fix**

Add `mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]` and `mock_outputs_merge_strategy_with_state = "shallow"` to every dependency block, or define them once in `_envcommon` (CPLX-3).

#### REL-8 · Medium · effort S — Prod has almost no destroy guardrails, and a dev destroy would take prod's registry and dataset with it

**Where**

- `infrastructure/environments/prod/f1v-webapp/terragrunt.hcl`
- `infrastructure/modules/cloud-run-frontend/variables.tf:22-26`
- `infrastructure/environments/dev/artifact-registry/terragrunt.hcl`
- `infrastructure/environments/dev/bigquery/terragrunt.hcl`
- `infrastructure/modules/redis/main.tf`

**Evidence**

`deletion_protection` is set for the five prod backend services and Firestore, but the prod `f1v-webapp` never passes it (the module default is false; it is the only never-set variable in the tree). Redis, the BigQuery dataset, the VPC, the static IPs, the load balancers, the gateway and the registry have no protection at all. The registry and dataset that prod uses are declared in the **dev** environment, so `terragrunt run --all destroy` in dev deletes prod's images and tables.

**Why it matters**

One wrong `destroy`, or a unit rename that plans a replace, removes a production dependency without a prompt.

**Fix**

Terragrunt `prevent_destroy = true` in every prod unit and in the shared units; `deletion_protection = true` on prod `f1v-webapp`; move shared resources into a platform layer (CPLX-2) so an environment destroy is scoped to that environment.

#### REL-9 · Medium · effort S — No backups, point-in-time recovery or maintenance windows for the stateful services

**Where**

- `infrastructure/modules/firestore/main.tf:1-9`
- `infrastructure/modules/redis/main.tf:1-24`

**Evidence**

Firestore has no `point_in_time_recovery_enablement` and no `google_firestore_backup_schedule`; Redis has no `maintenance_policy`, so Google picks the window, and no `persistence_config` (acceptable for a cache, but not stated).

**Why it matters**

A bad write to user preferences or reference data in prod is unrecoverable; a Redis maintenance restart can land in the middle of a live session.

**Fix**

Prod: `point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"`, a daily backup schedule with 7 to 14 day retention, and `maintenance_policy { weekly_maintenance_window { day = "SUNDAY" ... } }` on Redis. Add a comment that persistence is intentionally off.

#### REL-10 · Medium · effort S — Timeouts disagree: 60 s gateway deadline behind a 30 s load-balancer backend, and a 10 minute default build timeout for the infrastructure pipeline

**Where**

- `infrastructure/openapi.yaml:63`
- `infrastructure/modules/lb-api/main.tf:67-80`
- `cloudbuild/infrastructure.yaml`

**Evidence**

Every `x-google-backend` sets `deadline: 60.0`, but `google_compute_backend_service.default` leaves `timeout_sec` at its default of 30. `cloudbuild/infrastructure.yaml` sets no `timeout`, so Cloud Build's 10 minute default applies to a run that downloads tooling and applies up to 17 units, one of which can be a STANDARD_HA Redis (10 to 15 minutes to create) or a managed certificate.

**Why it matters**

A slow BigQuery query returns a 504 from the load balancer while the gateway is still waiting, and the first apply of any large resource in a new environment times out half-applied.

**Fix**

`timeout_sec = 60` on the API backend (or reduce the deadline), and `timeout: 3600s` in `cloudbuild/infrastructure.yaml`.

#### REL-11 · Low · effort S — Three empty `data` units exist, and dev commits Terragrunt-generated files

**Where**

- `infrastructure/environments/dev/data/terragrunt.hcl`
- `infrastructure/environments/uat/data/terragrunt.hcl`
- `infrastructure/environments/prod/data/terragrunt.hcl`
- `infrastructure/environments/dev/data/backend.tf`
- `infrastructure/environments/dev/data/provider.tf`

**Evidence**

Each `data/terragrunt.hcl` contains only the root include and no `terraform.source`. `run --all` treats them as units, runs `tofu` in a directory with nothing but generated `backend.tf` and `provider.tf`, and writes an empty `environments/<env>/data/terraform.tfstate`. The dev copy also has the two generated files committed (`# Generated by Terragrunt`), which `.gitignore` does not cover.

**Why it matters**

Noise in every run, an empty state object per environment, and generated files that will show as modified after every local run.

**Fix**

Delete the three directories (or turn them into the per-environment BigQuery units from CPLX-2) and add `backend.tf`/`provider.tf` under `environments/**` to `.gitignore`.

#### REL-12 · Low · effort S — The Redis tier is decided by string comparison on the environment name, and prod passes an input the module does not declare

**Where**

- `infrastructure/modules/redis/main.tf:3`
- `infrastructure/modules/redis/main.tf:4`
- `infrastructure/environments/prod/redis/terragrunt.hcl:27`

**Evidence**

`tier = var.environment == "prod" ? "STANDARD_HA" : "BASIC"` and `memory_size_gb = 1` are hard-coded; `environments/prod/redis/terragrunt.hcl` passes `tier = "STANDARD_HA"`, which Terragrunt exports as `TF_VAR_tier` and OpenTofu silently ignores because no such variable exists.

**Why it matters**

A reader of the prod unit believes `tier` is what sets HA; renaming the environment or adding a `staging` environment would silently produce a BASIC instance.

**Fix**

Declare `tier` and `memory_size_gb` variables with validation; delete the conditional. `terragrunt hcl validate --inputs --strict` (formerly `validate-inputs`) catches this class of mismatch in CI (DLV-3).

### Performance and cost (PERF)

#### PERF-1 · High · effort M — Replace the three Serverless VPC Access connectors with Direct VPC egress

**Where**

- `infrastructure/modules/networking/main.tf:65-73`
- `infrastructure/modules/networking/main.tf:14-23`
- `infrastructure/modules/cloud-run-backend/main.tf:19-25`

**Evidence**

Each environment runs a connector with 2 to 3 always-on instances (`min_throughput = 200`, `max_throughput = 300`), which is both a cost floor (roughly $12 to $18 per month per environment at list price) and a bandwidth ceiling shared by the telemetry, ingestion and replay-worker services. The subnet `f1v_subnet` (10.0.0.0/24) that Direct VPC egress would use already exists and is otherwise unused. Provider 8.2 supports `vpc_access { network_interfaces { network, subnetwork } }`.

**Why it matters**

An extra hop and a throughput cap on the hottest path in the system (Redis pub/sub fan-out to the WebSocket broadcaster), plus a fixed monthly charge for idle instances in dev and uat.

**Fix**

Switch the module to `network_interfaces` with `egress = "PRIVATE_RANGES_ONLY"`, keep the firewall rule with the subnet as source, delete `google_vpc_access_connector` and the `connector_cidr` variable. Each instance takes one subnet IP, so /24 is ample. Roll dev first; the change replaces revisions, not services.

#### PERF-2 · High · effort S — Put Cloud CDN in front of the SPA

**Where**

- `infrastructure/modules/lb-frontend/main.tf:19-35`
- `frontend/nginx.conf:212-226`
- `frontend/nginx.conf:162-165`

**Evidence**

The frontend backend service has no `enable_cdn`. nginx already emits the right headers: hashed assets get `Cache-Control: max-age=315360000`, `index.html` gets `no-cache`. Every asset request still travels to a Cloud Run instance today.

**Why it matters**

Cold starts and instance count on the frontend scale with page views instead of with deploys; users far from us-central1 pay the full round trip for a 300 kB bundle.

**Fix**

`enable_cdn = true` with `cdn_policy { cache_mode = "USE_ORIGIN_HEADERS" negative_caching = true serve_while_stale = 86400 }`. With brotli negotiated at the edge and origin headers honoured, the change is one block and needs no nginx change. Add `cache_key_policy { include_query_string = false }` for the static paths.

#### PERF-3 · Medium · effort L — Every REST call pays for an extra public hop through API Gateway

**Where**

- `infrastructure/modules/lb-api/main.tf:19-32`
- `infrastructure/modules/lb-api/main.tf:60-80`
- `infrastructure/openapi.yaml`

**Evidence**

The path is browser, global load balancer, internet NEG to `*.gateway.dev` over the public internet with a Host rewrite, API Gateway, then Cloud Run over the public `*.run.app` URL (which is why the REST services must keep `INGRESS_TRAFFIC_ALL`). Two extra TLS terminations and the gateway's own processing sit in front of services that already validate the same Auth0 JWT.

**Why it matters**

Tens of milliseconds per request and two extra failure domains, on the calls the splash screen prefetches and that `min_instance_count = 1` exists to make fast.

**Fix**

Route directly: serverless NEGs per service with `path_rule` entries for `/api/v1/users/*`, `/api/v1/analysis/*`, `/api/v1/ingestion/*` and `/ws/*`, and `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` on every service. This is the same change as CPLX-1, which lists the trade-offs.

#### PERF-4 · Medium · effort S — Always-on compute in dev and uat costs about as much as prod

**Where**

- `infrastructure/environments/dev/f1v-service-telemetry/terragrunt.hcl:61-66`
- `infrastructure/environments/dev/f1v-service-replay-worker/terragrunt.hcl:55-65`
- `infrastructure/environments/uat/f1v-service-telemetry/terragrunt.hcl`
- `infrastructure/environments/uat/f1v-service-replay-worker/terragrunt.hcl`

**Evidence**

Telemetry (2 vCPU, `cpu_idle = false`, `min_instance_count = 1`) and the replay worker (same, capped at one instance) are billed as always-allocated instances in every environment, at roughly $100 per month each at list price. Ingestion, analysis and user add warm instances on top. The cost table below puts non-prod always-on compute near $400 per month.

**Why it matters**

Two thirds of the estate's compute bill buys latency for environments that have no users outside working hours.

**Fix**

- Dev and uat: `min_instance_count = 0` for the three REST services; keep the worker at one instance only in uat, or scale both the worker and telemetry to zero outside working hours with a Cloud Scheduler job that calls `gcloud run services update --min-instances` (the replay state survives in Redis).
- Prod: a committed-use discount for Cloud Run once usage is steady; `memory` on the worker sized from actual heap, not the 1 GiB guess.

**Verify**

Figures are list-price estimates (730 h, before free tier); confirm against the billing export or run Infracost on the prod environment.

#### PERF-5 · Medium · effort S — The infrastructure pipeline re-downloads its toolchain and the 100 MB Google provider up to 18 times per run

**Where**

- `cloudbuild/infrastructure.yaml:19-44`
- `cloudbuild/infrastructure.yaml:60-70`
- `infrastructure/root.hcl`

**Evidence**

Step 1 installs `curl`/`unzip` and downloads OpenTofu and Terragrunt on every build. `terragrunt run --all -- init` then initialises 17 units, each with its own `.terragrunt-cache` and its own provider download (18 with `google-beta` in the gateway unit). No `TF_PLUGIN_CACHE_DIR`, no Terragrunt provider cache, no `--parallelism` tuning.

**Why it matters**

Minutes of wall-clock per run spent on network I/O, and a pipeline whose duration depends on GitHub release CDN latency.

**Fix**

Set `TG_PROVIDER_CACHE=1` (Terragrunt's provider cache server) or `TF_PLUGIN_CACHE_DIR=/workspace/.tf-plugin-cache`; build a small digest-pinned builder image with both tools once and reference it in the three Terragrunt steps (DLV-2 covers checksum verification); pass `--parallelism 4` so independent units apply concurrently without hammering the API quota.

#### PERF-6 · Low · effort S — BigQuery layout: the laps table is neither partitioned nor clustered, and storage billing is the default

**Where**

- `infrastructure/modules/bigquery/main.tf:15-36`
- `infrastructure/modules/bigquery/main.tf:1-12`

**Evidence**

`laps` is read by `session_key` on every lap-chart request but has no clustering; `telemetry` and `locations` are partitioned and clustered and require partition filters. The dataset has the default logical storage billing and 7 day time travel.

**Why it matters**

Each lap query scans the whole table; storage for the highly compressible telemetry rows is billed on uncompressed size.

**Fix**

`clustering = ["session_key", "driver_number"]` on `laps` (and on `results`, `session_drivers`); `storage_billing_model = "PHYSICAL"` and `max_time_travel_hours = 48` on the dataset after checking the ratio in `INFORMATION_SCHEMA.TABLE_STORAGE`.

#### PERF-7 · Low · effort M — Reference data could be served from the edge instead of from a warm JVM

**Where**

- `infrastructure/environments/dev/f1v-service-data-analysis/terragrunt.hcl:31-35`
- `infrastructure/modules/lb-api/main.tf:67-80`
- `infrastructure/openapi.yaml:111-146`

**Evidence**

`/api/v1/analysis/drivers`, `/sessions`, `/years` and `/sessions/year/{year}` return the same bytes for every user, yet each call is a BigQuery round trip, which is the stated reason the analysis service keeps a warm instance.

**Why it matters**

Latency on the splash-screen prefetch is bounded by BigQuery, and the warm instance is a standing cost to hide it.

**Fix**

Have the service emit `Cache-Control: public, max-age=300` on those endpoints and enable Cloud CDN on the API backend with `cache_mode = "USE_ORIGIN_HEADERS"`; CDN caches only what the origin marks public, so authenticated per-user responses stay uncached. Then `min_instance_count = 0` on analysis becomes viable.

#### PERF-8 · Low · effort S — State the Cloud Run execution environment and right-size the frontend container

**Where**

- `infrastructure/modules/cloud-run-backend/main.tf:9-10`
- `infrastructure/modules/cloud-run-frontend/main.tf:20-27`

**Evidence**

Neither module sets `template.execution_environment`. The frontend requests 1 vCPU and 512 MiB for nginx serving static files.

**Why it matters**

Gen1 versus gen2 is decided by the platform rather than by the code; services with `cpu_idle = false` and background threads are the documented case for gen2. The frontend over-provisions memory that CDN (PERF-2) makes even less necessary.

**Fix**

`execution_environment = "EXECUTION_ENVIRONMENT_GEN2"` as a module variable defaulting to gen2; `memory = "256Mi"` on the frontend once CDN is on.

### Complexity and maintainability (CPLX)

#### CPLX-1 · High · effort L — The API Gateway layer no longer earns what it costs; retire it, or own it fully in IaC

**Where**

- `infrastructure/modules/api-gateway/main.tf`
- `infrastructure/openapi.yaml`
- `cloudbuild/api-gateway.yaml`
- `infrastructure/modules/lb-api/main.tf:19-32`
- `infrastructure/modules/iam-and-secrets/main.tf:41-45`
- `infrastructure/environments/dev/api-gateway/terragrunt.hcl:23-46`

**Evidence**

What the gateway does today: validate the Auth0 JWT (the services already do this and the comments call it "defence in depth") and route 17 paths to four services (a URL map does this). What keeping it costs: a beta-only provider that is neither declared nor pinned; a placeholder OpenAPI spec applied by IaC and then ignored with `ignore_changes = [api_config]`; a separate Cloud Build pipeline that discovers URLs with `gcloud`, rewrites the spec with seven `sed` commands and sleeps 30 s before a smoke test; an internet NEG with a Host rewrite; a dedicated gateway service account and invoker bindings; `INGRESS_TRAFFIC_ALL` on the REST services because the gateway calls them from outside the VPC; and the 30 s/60 s timeout mismatch (REL-10). The gateway's other capabilities (API keys, quotas, request validation) are unused.

**Why it matters**

Roughly a third of the moving parts in `infrastructure/` and one of four pipelines exist to feed a component that duplicates work done elsewhere, and its bootstrap trick is the kind of thing that only one person understands.

**Fix**

**Option A (recommended): retire it.** Serverless NEGs for user, analysis and ingestion on the API load balancer with `path_rule` entries per prefix (the WebSocket rule already works this way), `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` plus `allUsers` invoker on every service (the pattern telemetry uses today), Cloud Armor for rate limiting (SEC-4), and delete `openapi.yaml`, `cloudbuild/api-gateway.yaml`, the api-gateway module and trigger, the gateway service account and the internet NEG. Trade-offs: unlisted paths are no longer 404 at the edge (Spring's `anyRequest().authenticated()` covers them), and gateway request metrics are replaced by load-balancer logs (OPS-2).

**Option B: keep it and own it.** Turn `openapi.yaml` into `openapi.yaml.tftpl`, render it with `templatefile()` from `dependency` outputs of the four service units, and let `api_config_id_prefix` plus `create_before_destroy` roll configs; the pipeline and the placeholder disappear, and `ignore_changes` goes with them.

**Verify**

Option B needs the `host` field resolved from `google_api_gateway_api.api.managed_service` rather than the gateway hostname; confirm the gateway accepts it before committing to B.

#### CPLX-2 · High · effort M — Shared resources hide inside the dev environment, and the data tier is not isolated per environment

**Where**

- `infrastructure/environments/dev/artifact-registry/terragrunt.hcl`
- `infrastructure/environments/uat/artifact-registry/terragrunt.hcl`
- `infrastructure/environments/dev/bigquery/terragrunt.hcl`
- `infrastructure/modules/bigquery/main.tf:2`
- `README.md:900-902`

**Evidence**

The Artifact Registry repository that prod pulls from is declared in `environments/dev` (uat has its own in us-east1 with the same `repository_id`). The BigQuery dataset `f1_dataset` exists only in dev and is read and written by all three environments; the backend already honours `F1V_BIGQUERY_DATASET`, but no unit sets it. The OpenF1 secrets, the state bucket, the enabled APIs and the GitHub connection are shared and unmanaged.

**Why it matters**

A UAT historical load writes into the tables prod reads; a dev destroy removes prod's images (REL-8); a newcomer cannot tell from the tree which resources are per-environment.

**Fix**

Create `infrastructure/platform/` (its own state prefix) for the registry, state bucket, project services, shared secret containers and the GitHub connection. Add a `bigquery` unit to every environment with `dataset_id = "f1_dataset_${env}"` and set `F1V_BIGQUERY_DATASET` on the analysis, ingestion and replay-worker services; migrate prod's rows once with a `CREATE TABLE ... COPY`. Delete the dev-only units.

#### CPLX-3 · High · effort M — Forty-eight near-identical unit files: derive environment facts once instead of repeating them

**Where**

- `infrastructure/environments`
- `infrastructure/root.hcl`
- `infrastructure/environments/dev/f1v-service-data-analysis/terragrunt.hcl`
- `infrastructure/environments/prod/f1v-service-data-analysis/terragrunt.hcl`

**Evidence**

Across the tree the project id appears 116 times, `us-central1` 54 times and `us-east1` 20, the Auth0 tenant 18 times, the Firestore database id 12 times, the registry host 20 times. After normalising the environment name, the dev and prod copies of the five service units still differ by 13 to 27 lines each. REL-2 is what this looks like in practice: one of three copies drifted.

**Why it matters**

Every change is a three-way copy, every review reads the same block three times, and the diff between environments is buried in prose comments rather than visible in a few lines of overrides.

**Fix**

- `environments/<env>/env.hcl` with `locals` for project, region, environment, Auth0 issuer and audience, Firestore id, registry host, domains and labels; read it in `root.hcl` with `read_terragrunt_config(find_in_parent_folders("env.hcl"))` and merge into `inputs`.
- `infrastructure/_envcommon/<unit>.hcl` per unit type (one per backend service, one each for the LBs, redis, networking, firestore, triggers) included with `include "envcommon" { ... merge_strategy = "deep" }`; a per-environment file then holds only overrides such as `deletion_protection = true`.
- Or, since the pipeline already runs Terragrunt 1.x, a `terragrunt.stack.hcl` per environment that generates the units from one definition. Either route ends with about three `env.hcl` files, about sixteen shared unit definitions and a handful of one-line overrides.

#### CPLX-4 · Medium · effort S — The Cloud Run module surface invites the SEC-2 mistake and mixes API generations

**Where**

- `infrastructure/modules/cloud-run-backend/variables.tf:27-31`
- `infrastructure/modules/cloud-run-backend/variables.tf:42-46`
- `infrastructure/modules/cloud-run-backend/variables.tf:93-111`
- `infrastructure/modules/cloud-run-backend/main.tf:115-134`
- `infrastructure/modules/cloud-run-frontend/main.tf`

**Evidence**

`service_account_email` defaults to `null` with the comment "we will enforce it in Terragrunt" (nothing does). `is_public` and `invoker_service_accounts` are two variables for one concept. The `ingress` description names `INGRESS_TRAFFIC_INTERNAL_AND_CLOUD_LOAD_BALANCING`, which is not a valid value, and the default is the most open one. IAM uses the v1 `google_cloud_run_service_iam_member` against a v2 service. The frontend module is the backend module minus probes and plus a hard-coded ingress.

**Why it matters**

Safe use depends on every caller remembering the right inputs; the two modules drift independently (the frontend already lacks labels, service account and lifecycle rules).

**Fix**

Make `service_account_email` required; replace the two invoker variables with `invokers = list(string)` that accepts `"allUsers"`; default `ingress` to `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`; switch to `google_cloud_run_v2_service_iam_member`; fold the frontend module into the backend module with `probe_path` and `probe_port` variables (or a shared submodule) so there is one place to add `execution_environment`, labels and `ignore_changes`.

#### CPLX-5 · Medium · effort S — Provider configuration is incomplete and nothing carries labels

**Where**

- `infrastructure/root.hcl:24-33`
- `infrastructure/modules/api-gateway/versions.tf`
- `infrastructure/modules/api-gateway/main.tf:2`
- `infrastructure/modules/cloud-run-backend/main.tf`
- `infrastructure/modules/lb-api/main.tf`

**Evidence**

`root.hcl` generates only `provider "google"`; the api-gateway module uses `google-beta` without declaring it, so `tofu init` resolves "latest" for it (observed: `Finding latest version of hashicorp/google-beta`) and it inherits no project or region. Only Redis, BigQuery, Artifact Registry and the Redis secret carry an `env` label; Cloud Run services, load balancers, networks, connectors and the gateway carry none.

**Why it matters**

A future 9.x `google-beta` release breaks the gateway unit with no diff in the repository; cost by environment cannot be split in billing because the largest line items are unlabeled.

**Fix**

Declare `google-beta` with `version = "~> 8.1"` in the gateway module and generate a matching `provider "google-beta"` block. Set `default_labels = { app = "f1v", env = <env>, managed_by = "terragrunt" }` on both providers in `root.hcl` (provider 8.2 supports it); every labelable resource then picks them up with no module changes.

#### CPLX-6 · Medium · effort S — Module hygiene: formatting fails, variables lack descriptions, types and validation, and there are no module docs

**Where**

- `infrastructure/modules/api-gateway/main.tf:8-11`
- `infrastructure/modules/cloud-run-frontend/variables.tf:11`
- `infrastructure/modules/networking/main.tf:65-73`
- `infrastructure/modules/firestore/variables.tf:22-26`
- `infrastructure/modules/lb-api/variables.tf:1-2`
- `infrastructure/modules/bigquery/main.tf:21-35`

**Evidence**

`tofu fmt -check -recursive` fails on three files (api-gateway/main.tf, cloud-run-frontend/variables.tf, networking/main.tf, which also lacks a final newline). Four modules declare one-line variables with no description. `firestore.delete_protection` is a string carrying an enum. `region`, `location` and `location_id` name the same thing in different modules. No variable has a `validation` block (environment in {dev, uat, prod}; cpu and memory formats), no resource has a `precondition` (prod implies deletion protection), no module has a README, and the BigQuery schemas are JSON heredocs inside HCL.

**Why it matters**

Small, but each is a review-time question that a validation or a description would answer once.

**Fix**

Run `tofu fmt -recursive` and gate it (DLV-3); add descriptions and `validation` blocks; type `delete_protection` as bool and map it inside the module; standardise on `region`; move schemas to `schemas/*.json` loaded with `file()` so the Java tests can read the same files; generate READMEs with `terraform-docs`.

#### CPLX-7 · Low · effort S — Dead configuration to delete

**Where**

- `infrastructure/environments/dev/f1v-service-data-ingestion/terragrunt.hcl:38`
- `infrastructure/modules/lb-api/main.tf:1-11`
- `infrastructure/modules/lb-api/main.tf:53`
- `infrastructure/modules/networking/main.tf:48-59`
- `infrastructure/modules/cloud-run-frontend/variables.tf:17-21`
- `.github/workflows/.gitkeep`

**Evidence**

`get_env("TF_VAR_image_url", ...)` in six units (nothing sets it). `ws_cors_response_headers` on the telemetry backend: CORS does not apply to WebSocket upgrades and SockJS is gone (nginx.conf says so; `sockjs-client` is not in package.json). `allow_icmp_from_connector` serves diagnostics nobody runs. `is_public` on the frontend module is documented as always true. The three `data` units (REL-11). The subnet becomes live only with PERF-1.

**Why it matters**

Each item is a question in review and a place for a future reader to assume intent that is not there.

**Fix**

Delete them in one commit titled as such.

#### CPLX-8 · Low · effort S — Trigger wiring: first-generation GitHub connection and an over-broad path filter

**Where**

- `infrastructure/modules/cloudbuild-triggers/main.tf:51-58`
- `infrastructure/modules/cloudbuild-triggers/main.tf:140-144`

**Evidence**

Triggers use the 1st-gen `github {}` block, whose repository connection is created by hand in the console. The api-gateway trigger includes `infrastructure/modules/**`, so any module edit redeploys the gateway configuration although the pipeline never reads the modules.

**Why it matters**

The connection is unmanaged state; module-only changes cause a gateway config rollout with a 30 s sleep and a smoke test for nothing.

**Fix**

Move to `google_cloudbuildv2_connection` + `google_cloudbuildv2_repository` with `repository_event_config`; narrow the gateway trigger to `infrastructure/openapi.yaml` and `cloudbuild/api-gateway.yaml` (or delete it under CPLX-1 option A).

### Delivery pipeline (DLV)

#### DLV-1 · High · effort M — Nothing plans before merge; the first real plan is post-merge and auto-applied seconds later

**Where**

- `.github/workflows/pr-checks.yml:214-239`
- `cloudbuild/infrastructure.yaml:72-94`
- `README.md:686-692`

**Evidence**

The GitHub job is named "Infrastructure Scan & Plan" but runs `tofu validate` per module and no plan, because GitHub Actions has no GCP credentials. The README's PR table repeats "infrastructure plan". A plan first exists inside the Cloud Build run that also applies it.

**Why it matters**

Reviewers approve promotion PRs to `dev`, `uat` and `prod` without ever seeing what will change; destroys and replacements are discovered when they happen.

**Fix**

Either Workload Identity Federation for GitHub Actions (`permissions: id-token: write`, `google-github-actions/auth`, a read-only planner identity with `roles/viewer` plus state-bucket read) running `terragrunt run --all -- plan` per environment on PRs to the environment branches and posting the summary as a comment, or a Cloud Build `pull_request` trigger per environment with `comment_control` that runs plan only. Pair with REL-5 so the apply uses the saved plan.

#### DLV-2 · High · effort S — The infrastructure pipeline's own supply chain is unpinned and unverified

**Where**

- `cloudbuild/infrastructure.yaml:20`
- `cloudbuild/infrastructure.yaml:33`
- `cloudbuild/infrastructure.yaml:39`
- `cloudbuild/infrastructure.yaml:49`
- `cloudbuild/frontend.yaml:20-34`

**Evidence**

`alpine:3.24` and `aquasec/trivy:0.74.0` are tag-pinned only; the frontend pipeline pins all four of its images by digest and explains why. OpenTofu and Terragrunt are fetched with `curl -sL` from GitHub releases with no `SHA256SUMS` check and no cosign verification, on every run, by the identity that holds project IAM admin (SEC-1).

**Why it matters**

A substituted release asset or a moved tag executes with the most privileged identity in the project, and two runs of the same commit can use different binaries.

**Fix**

Verify `tofu_${v}_SHA256SUMS` (and its cosign signature) and Terragrunt's `SHA256SUMS`, or build one digest-pinned builder image containing both tools and reference it from the three Terragrunt steps (also PERF-5). Pin the Trivy and Alpine images by digest like `frontend.yaml` does.

#### DLV-3 · Medium · effort S — Static checks that would have caught findings in this audit are missing from the PR gate

**Where**

- `.github/workflows/pr-checks.yml:233-239`
- `infrastructure/modules/networking/main.tf`
- `infrastructure/environments/prod/redis/terragrunt.hcl:27`

**Evidence**

The PR gate runs Trivy on modules and `tofu validate` per module. It does not run `tofu fmt -check -recursive` (fails today on three files), `terragrunt hcl fmt --check`, `terragrunt run --all -- validate` per environment (which validates the wiring rather than the modules in isolation), `terragrunt hcl validate --inputs --strict` (would flag the undeclared `tier` input, REL-12), `tflint --recursive` with the Google ruleset, or any policy check.

**Why it matters**

Formatting drift, undeclared inputs and environment wiring errors like REL-2 reach `main` green.

**Fix**

Add the four commands to the infrastructure job (Terragrunt installs in one step with `gruntwork-io/terragrunt-action` or a pinned download). Add a policy layer with the rules that matter here: no `google_project_iam_member` for data or secret roles, no `allUsers` outside an allow-list, prod implies deletion protection, no `:latest` image references. Conftest/OPA against `tofu show -json`, or Checkov custom policies, both fit the existing Trivy step.

#### DLV-4 · Medium · effort S — The IaC security scan cannot see the values that matter

**Where**

- `.github/workflows/pr-checks.yml:225-231`
- `cloudbuild/infrastructure.yaml:46-58`

**Evidence**

Both Trivy invocations scan `infrastructure/modules` only and log `Variable values were not found ... Evaluating may not work correctly` for every module. `is_public`, `ingress`, `deletion_protection`, `delete_protection` and the secret references are all Terragrunt inputs, so every security-relevant decision is invisible to the scanner. Today's run found three findings, all in code that has no variable.

**Why it matters**

The "IaC scanning on every PR" line in the README describes a control with almost no coverage.

**Fix**

Scan the rendered plan: `terragrunt run --all -- plan -out=tfplan`, `tofu show -json tfplan > plan.json`, then `trivy config --tf-plan plan.json` (or Checkov `-f plan.json`), which sees resolved inputs. Keep the module scan as a fast first pass and scan `environments/` too. Record accepted findings (VPC flow logs) in `.trivyignore` with a reason rather than leaving them open.

#### DLV-5 · Medium · effort S — Provider versions float between validate, plan and apply

**Where**

- `.gitignore:57`
- `infrastructure/modules/api-gateway/versions.tf`
- `infrastructure/modules/cloud-run-backend/versions.tf:4`
- `cloudbuild/infrastructure.yaml:12-13`

**Evidence**

`.terraform.lock.hcl` is gitignored, so each `init` resolves `~> 8.1` afresh (8.2.0 today) and `google-beta` resolves to latest with no constraint. `required_version = ">= 1.12.0"` is open-ended while CI pins 1.12.6; there is no `.tool-versions` or `mise.toml`, so a contributor's local versions are whatever they installed (Terragrunt is not installed on this machine).

**Why it matters**

The PR validation, the Cloud Build plan and the apply can each run a different provider build; a provider regression appears with no diff in the repository.

**Fix**

Un-ignore the lock file and commit one next to each `terragrunt.hcl` (Terragrunt copies it into and out of the cache), run `init -lockfile=readonly` in CI, pin `google-beta ~> 8.1`, set `required_version = "~> 1.12"`, and add a `mise.toml` with `opentofu = "1.12.6"` and `terragrunt = "1.1.4"`. Dependabot can then bump providers (DLV-6).

#### DLV-6 · Low · effort S — Dependabot does not cover Terraform providers or the Cloud Build step images

**Where**

- `.github/dependabot.yml`
- `cloudbuild/infrastructure.yaml:12-13`

**Evidence**

The file covers npm, Maven, two Dockerfile directories and GitHub Actions, and its own comments record that Cloud Build step images are bumped by hand. There is no `package-ecosystem: terraform` entry, and the OpenTofu and Terragrunt versions live in a Cloud Build substitution nothing watches.

**Why it matters**

Provider and tool pins go stale silently; the audit found the lock files already ignored, so there is nothing for Dependabot to update until DLV-5 lands.

**Fix**

Add `package-ecosystem: terraform` with `directories: ["/infrastructure/modules/*"]` after DLV-5. For the step images and the two tool versions, a small scheduled workflow that diffs against the latest release, or Renovate's `customManagers`, closes the gap the comments describe.

#### DLV-7 · Low · effort S — Terragrunt runtime flags: no lock timeout, no retry policy, no non-interactive default

**Where**

- `infrastructure/root.hcl`
- `cloudbuild/infrastructure.yaml:60-94`

**Evidence**

`root.hcl` has no `extra_arguments` block; the pipeline passes `--non-interactive` on each command line but sets no `-lock-timeout`, so a concurrent human `plan` fails the pipeline instead of waiting, and no `retryable_errors` covers the Google API's transient 409 and 429 responses.

**Why it matters**

Flaky applies that need a manual re-run, especially during the long resource creations in REL-10.

**Fix**

In `root.hcl`: `extra_arguments "locking" { commands = get_terraform_commands_that_need_locking() arguments = ["-lock-timeout=10m"] }`, a `retryable_errors` list for the Google API's `Error 409` and `rateLimitExceeded`, and `TG_NON_INTERACTIVE=true` in the pipeline environment.

#### DLV-8 · Low · effort S — No local pre-commit hooks, so contributors see formatting and scan failures only in CI

**Where**

- `infrastructure`
- `.editorconfig`

**Evidence**

There is no `.pre-commit-config.yaml`; the frontend has Prettier and the backend has Spotless-style checks bound to `verify`, but nothing runs `tofu fmt`, `terragrunt hcl fmt`, `tflint` or `trivy config` before a push.

**Why it matters**

The three fmt failures found today are the visible symptom; the invisible one is reviewers spending time on whitespace.

**Fix**

A `.pre-commit-config.yaml` with the `antonbabenko/pre-commit-terraform` hooks (fmt, validate, tflint, trivy, docs) scoped to `infrastructure/`, referenced from the README's contributing section.

### Operations and observability (OPS)

#### OPS-1 · High · effort M — No monitoring, alerting, SLOs or budgets are defined anywhere in IaC

**Where**

- `infrastructure/modules`
- `backend/f1v-service-telemetry/src/main/resources/application.yml:50-56`

**Evidence**

There is no `google_monitoring_uptime_check_config` for `f1visualizer.com` or `api.f1visualizer.com`, no `google_monitoring_alert_policy`, no notification channel, no `google_monitoring_slo` and no `google_billing_budget`. The services expose `/actuator/prometheus` and `/actuator/metrics`, and nothing scrapes them.

**Why it matters**

The first signal of a prod outage, a Redis eviction storm, a Cloud Run service pinned at `max_instance_count`, or a runaway bill is a user or an invoice.

**Fix**

A `monitoring` unit per environment: uptime checks on `/healthz` (frontend) and `/api/v1/analysis/years` (expect 401 through the load balancer), alert policies for load-balancer 5xx ratio and p95 latency, Cloud Run instance count near max and container restarts, Memorystore memory and evictions, Cloud Build failures; an email or chat notification channel; a `google_billing_budget` with 50/90/100 percent thresholds. Optionally the Managed Prometheus sidecar on the JVM services so the Micrometer metrics land in Cloud Monitoring.

#### OPS-2 · Medium · effort S — Load-balancer request logging is off, so the edge is blind

**Where**

- `infrastructure/modules/lb-api/main.tf:46-80`
- `infrastructure/modules/lb-frontend/main.tf:19-35`

**Evidence**

No backend service sets `log_config`, and logging is not enabled unless it is set. The only frontend signal is nginx's JSON access log inside the container; the API path has gateway logs but nothing from the load balancer that fronts both the gateway and the WebSocket backend.

**Why it matters**

4xx and 5xx rates, latency and client IPs at the edge cannot be queried; Cloud Armor (SEC-4) decisions would also be unlogged.

**Fix**

`log_config { enable = true sample_rate = 1.0 }` on the API and telemetry backends and `sample_rate = 0.1` on the frontend backend. VPC flow logs (Trivy GCP-0076/GCP-0029) add little here; either enable at a 0.1 sample or record the acceptance in `.trivyignore`.

#### OPS-3 · Medium · effort M — Project-level plumbing lives outside IaC: APIs, DNS, the GitHub connection, org policies, log retention

**Where**

- `infrastructure/root.hcl`
- `infrastructure/modules/lb-api/main.tf:129-136`
- `infrastructure/modules/cloudbuild-triggers/main.tf:51-58`

**Evidence**

No `google_project_service` enables the fifteen or so APIs the modules need; the DNS zone and the six A records that the managed certificates depend on are not in the repository; the Cloud Build GitHub connection, Data Access audit logs and the `_Default` log bucket retention are all console state.

**Why it matters**

A new project cannot be stood up from the repository, and the managed certificates' well-known bootstrap failure (cert stuck in PROVISIONING until DNS points at the address) has no codified answer.

**Fix**

Add to the platform layer (CPLX-2): `google_project_service` for each API with `disable_on_destroy = false`, `google_dns_managed_zone` and `google_dns_record_set` fed by the load-balancer address outputs, `google_project_iam_audit_config` for Secret Manager, Firestore and BigQuery, `google_logging_project_bucket_config` with 90 or 400 day retention for audit logs, and the org policies from SEC-9 where an organization exists.

#### OPS-4 · Low · effort S — Artifact Registry has no cleanup policy or tag immutability

**Where**

- `infrastructure/modules/artifact-registry/main.tf:1-11`
- `cloudbuild/backend-service.yaml:96-103`

**Evidence**

Every build pushes a new SHA tag and re-points `latest`; nothing deletes old images, and tags are mutable.

**Why it matters**

Storage grows without bound, and a tag can be re-pointed after it was scanned and deployed.

**Fix**

`cleanup_policies` keeping the most recent 20 tagged versions and deleting untagged images older than 30 days; consider `docker_config { immutable_tags = true }` once REL-1 removes the reliance on floating `latest` tags. Enable Artifact Analysis scanning on the repository so the registry, not only the pipeline, reports new CVEs in already-deployed images.

#### OPS-5 · Low · effort S — The README's infrastructure sections have drifted from the code

**Where**

- `README.md:533-596`
- `README.md:669-760`
- `README.md:833-850`
- `README.md:864-902`

**Evidence**

The README says six service accounts (there are eight), five Cloud Run services (six), seven triggers (eight), four `backend-*.yaml` pipelines (one `backend-service.yaml`), "Telemetry: Redis subscribe only", prod "requires approval", three parallel PR jobs (four), "Infra: plan" (validate only) and `mvn clean package` (now `verify`).

**Why it matters**

New contributors and reviewers trust a description that is wrong in the places that matter most (approval, permissions).

**Fix**

Generate the module inventory with `terraform-docs`, keep the environment table, and delete the pipeline diagrams that duplicate the YAML. Re-read the security table after SEC-1 to SEC-3 land.

## Run-rate estimate

| Item | dev | uat | prod |
|---|---:|---:|---:|
| Telemetry (2 vCPU always allocated, 1 GiB, min 1) | ≈ $100 | ≈ $100 | ≈ $100 |
| Replay worker (2 vCPU always allocated, 1 GiB, 1 instance) | ≈ $100 | ≈ $100 | ≈ $100 |
| Ingestion, analysis, user (throttled, min 1 each) | ≈ $25–35 | ≈ $25–35 | ≈ $25–35 |
| Serverless VPC Access connector (2–3 e2-micro) | ≈ $12–18 | ≈ $12–18 | ≈ $12–18 |
| Memorystore 1 GB (BASIC / BASIC / STANDARD_HA) | ≈ $36 | ≈ $36 | ≈ $72 |
| Global load balancers (6 forwarding rules across envs) | ≈ $25 total |  |  |

Roughly $270 (dev), $270 (uat) and $310 (prod) per month before traffic, BigQuery and egress: about $850 in total, of which about $400 is always-on compute in environments with no users overnight. Verify with the billing export or Infracost; these are list-price estimates.

## Sequencing

### Now: a day of small, reviewable changes

- **REL-2** The UAT replay worker is defined in us-central1 while every other UAT resource is in us-east1
- **REL-1** Any prod infrastructure apply can roll the backend services onto whatever image was built last, including a dev build
- **SEC-2** The frontend Cloud Run service runs as the default compute service account
- **REL-8** Prod has almost no destroy guardrails, and a dev destroy would take prod's registry and dataset with it
- **REL-12** The Redis tier is decided by string comparison on the environment name, and prod passes an input the module does not declare
- **REL-11** Three empty `data` units exist, and dev commits Terragrunt-generated files
- **REL-10** Timeouts disagree: 60 s gateway deadline behind a 30 s load-balancer backend, and a 10 minute default build timeout for the infrastructure pipeline
- **REL-7** Mock outputs are allowed for every command, so an apply can use MOCK values
- **REL-5** Prod applies with no approval and no plan-apply separation, contrary to the README
- **SEC-8** Dead Pub/Sub grants and an over-broad builder role
- **OPS-2** Load-balancer request logging is off, so the edge is blind
- **DLV-2** The infrastructure pipeline's own supply chain is unpinned and unverified
- **CPLX-6** Module hygiene: formatting fails, variables lack descriptions, types and validation, and there are no module docs
- **CPLX-7** Dead configuration to delete

### Next sprint: identities, plan gates and the two performance wins

- **SEC-1** One over-privileged CI identity per environment runs both the app pipelines and the infrastructure pipeline
- **SEC-3** Project-wide data and secret roles let every environment's runtime identity reach every other environment's data
- **REL-4** The infrastructure pipeline identity cannot manage several of the resources the code declares
- **REL-3** Memorystore in-transit encryption is enabled, but the services are never given the CA they must trust
- **DLV-1** Nothing plans before merge; the first real plan is post-merge and auto-applied seconds later
- **DLV-3** Static checks that would have caught findings in this audit are missing from the PR gate
- **DLV-4** The IaC security scan cannot see the values that matter
- **DLV-5** Provider versions float between validate, plan and apply
- **PERF-1** Replace the three Serverless VPC Access connectors with Direct VPC egress
- **PERF-2** Put Cloud CDN in front of the SPA
- **SEC-4** No Cloud Armor policy on either load balancer
- **SEC-5** TLS and edge posture: no SSL policy, classic managed certificates, no HTTP redirect, no IPv6
- **SEC-6** Secrets are half-managed: the module named iam-and-secrets manages none, and the OpenF1 credentials are shared by all environments at `latest`
- **OPS-1** No monitoring, alerting, SLOs or budgets are defined anywhere in IaC
- **REL-9** No backups, point-in-time recovery or maintenance windows for the stateful services
- **CPLX-5** Provider configuration is incomplete and nothing carries labels
- **CPLX-4** The Cloud Run module surface invites the SEC-2 mistake and mixes API generations

### Structural: shape the tree so the first two phases stay fixed

- **CPLX-2** Shared resources hide inside the dev environment, and the data tier is not isolated per environment
- **CPLX-3** Forty-eight near-identical unit files: derive environment facts once instead of repeating them
- **CPLX-1** The API Gateway layer no longer earns what it costs; retire it, or own it fully in IaC
- **PERF-3** Every REST call pays for an extra public hop through API Gateway
- **OPS-3** Project-level plumbing lives outside IaC: APIs, DNS, the GitHub connection, org policies, log retention
- **PERF-4** Always-on compute in dev and uat costs about as much as prod
- **PERF-7** Reference data could be served from the edge instead of from a warm JVM
- **SEC-9** Enable the security plumbing that only exists at project level: audit logs, org policies, Binary Authorization

### Any time: housekeeping that fits alongside other work

- **SEC-7** State holds the Memorystore AUTH string in clear text, in a bucket that IaC does not manage
- **SEC-10** The frontend keeps a second public origin on `*.run.app`
- **REL-6** Ordering dependencies are expressed as name strings, so a fresh environment applies in the wrong order
- **PERF-5** The infrastructure pipeline re-downloads its toolchain and the 100 MB Google provider up to 18 times per run
- **PERF-6** BigQuery layout: the laps table is neither partitioned nor clustered, and storage billing is the default
- **PERF-8** State the Cloud Run execution environment and right-size the frontend container
- **CPLX-8** Trigger wiring: first-generation GitHub connection and an over-broad path filter
- **DLV-6** Dependabot does not cover Terraform providers or the Cloud Build step images
- **DLV-7** Terragrunt runtime flags: no lock timeout, no retry policy, no non-interactive default
- **DLV-8** No local pre-commit hooks, so contributors see formatting and scan failures only in CI
- **OPS-4** Artifact Registry has no cleanup policy or tag immutability
- **OPS-5** The README's infrastructure sections have drifted from the code

## Already right

- REST services are private: `allUsers` removed, gateway identity granted `run.invoker` per service, telemetry restricted to load-balancer ingress.
- The Memorystore AUTH string is generated by GCP, landed in Secret Manager and mounted as a secret environment variable, never passed as a plain input.
- Startup and liveness probes on every JVM service, against the Actuator readiness and liveness groups, with a generous cold-start budget.
- `require_partition_filter` and clustering on the two large BigQuery tables; precomputed driver stats instead of a ten-CTE query per request.
- CORS preflight answered at the load-balancer edge, which removed a documented cascade failure.
- Application images pinned by digest, distroless non-root runtime, Trivy on both the source tree and the built image, SBOM retained per run.
- Deletion protection on the prod backend services and prod Firestore; STANDARD_HA Redis in prod only.
- The frontend deploy is gated: deploy without traffic, smoke test on the tag URL, then promote by tag.
- One shared backend pipeline with path-filtered triggers instead of four copies; provider constraints added to every module on 2026-09-06.
- The VPC firewall was narrowed to TCP 6379 from the connector range, replacing an allow-all rule.

## Method and scope

- Read every file under `infrastructure/` (root.hcl, 12 modules, 48 units, openapi.yaml), the four Cloud Build pipelines, the PR workflow, Dependabot and CODEOWNERS, both Dockerfile pairs, nginx.conf, the Spring `application*.yml` files and the README's infrastructure sections.
- Ran `tofu fmt -check -recursive` (3 files fail), `tofu init -backend=false` and `tofu validate` on all 12 modules (all valid; google 8.2.0 resolved, google-beta 8.2.0 pulled unconstrained by the gateway module), `trivy config` 0.74.0 (1 MEDIUM IAM, 1 MEDIUM and 1 LOW flow-log findings), and inspected the provider schema for the attributes the drift and TLS findings depend on.
- Scripted checks for undeclared Terragrunt inputs, never-set module variables, literal duplication and dev-versus-prod unit similarity.
- No calls were made to the live GCP project. Findings that depend on live state (IAM policy, bucket settings, Redis connectivity, cost) are marked with a verification step.

```
$ tofu fmt -check -recursive infrastructure/
modules/api-gateway/main.tf
modules/cloud-run-frontend/variables.tf
modules/networking/main.tf            (also: no newline at end of file)

$ for m in infrastructure/modules/*; do tofu -chdir=$m init -backend=false && tofu -chdir=$m validate; done
12/12  Success! The configuration is valid.
api-gateway: Finding latest version of hashicorp/google-beta ... Installing hashicorp/google-beta v8.2.0

$ trivy config --severity CRITICAL,HIGH,MEDIUM,LOW infrastructure/modules
iam-and-secrets/main.tf:65   GCP-0011  MEDIUM  project-level roles/iam.serviceAccountUser
networking/main.tf:14-23     GCP-0076  MEDIUM  subnetwork flow logs disabled
networking/main.tf:14-23     GCP-0029  LOW     subnetwork flow logs disabled

$ (script) undeclared inputs
environments/prod/redis/terragrunt.hcl -> redis: ['tier']
environments/{dev,uat,prod}/data/terragrunt.hcl: no terraform.source (empty unit)
never set by any environment: cloud-run-frontend: deletion_protection, max_instance_count, min_instance_count
```

Scope: infrastructure/ (root.hcl, 12 modules, 48 Terragrunt units, openapi.yaml) plus the pipelines and application configuration that consume it.
