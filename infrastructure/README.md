# Infrastructure

OpenTofu modules under `modules/`, one Terragrunt unit per resource per
environment under `environments/<env>/`. `cloudbuild/infrastructure.yaml` plans
and applies an environment on a push to that environment's branch.

`platform/` is the exception: it holds what dev, uat and prod share — the state
bucket, the Artifact Registry repositories, the OpenF1 secret containers, the
enabled APIs, the DNS zone and the audit configuration. It sits outside
`environments/` deliberately, so `terragrunt run --all` in one environment cannot
apply or destroy resources another depends on (CPLX-2, REL-8). Apply it directly,
and rarely:

    cd infrastructure/platform && terragrunt apply

Changes that need a step beyond an apply — imports, the BigQuery dataset split,
the Certificate Manager cutover, the CI identity switch — are in
[MIGRATIONS.md](MIGRATIONS.md).

## Bootstrap order

REL-4: the pipeline identity cannot create everything the code declares, and it
never could — a human with Owner created the first copy of each of these, and
that was written down nowhere. This is that order. Everything below is a
one-time, out-of-band step for a project that does not exist yet.

1. **Enable two APIs by hand.** `cloudresourcemanager` and `serviceusage`.
   The platform layer enables the other seventeen, but it cannot enable the ones
   it needs in order to run.

2. **Create the state bucket.** `gs://<project>-tfstate`. `root.hcl` expects it
   to exist before any unit can store state, including the platform unit that
   declares it. Versioning on, uniform bucket-level access,
   `public_access_prevention = enforced` — then import it, so the settings stop
   being a matter of trust (SEC-7, MIGRATIONS.md).

3. **Apply the `iam-and-secrets` unit as a human with Owner.** It creates the two
   CI identities that everything else runs as, so it cannot create itself:

       cd environments/<env>/iam-and-secrets && terragrunt apply

4. **Connect the repository to Cloud Build.** By default the triggers use the
   first-generation `github {}` block, whose connection is made once in the
   console and is not a Terraform resource (CPLX-8). The second-generation path
   is declared: set `github_app_installation_id` and `github_token_secret_version`
   on the platform unit to have it create the connection and repository link,
   then point each environment's `cloudbuild_repository_id` at the
   `cloudbuild_repository_id` output and the triggers switch to
   `repository_event_config`.

5. **Add the OpenF1 credential values.** SEC-6 declares the two containers in
   the platform layer (`google_secret_manager_secret.shared`, keyed by secret
   id, in `modules/platform`) — once for the project, not per environment; the
   values are added out of band so they never enter state:

       printf '%s' "$OPENF1_EMAIL"    | gcloud secrets versions add f1v-api-openf1-login-user-email    --data-file=-
       printf '%s' "$OPENF1_PASSWORD" | gcloud secrets versions add f1v-api-openf1-login-user-password --data-file=-

   **On an existing project the containers already exist**, created by hand
   before they were declared. Import them once, from the platform directory, or
   the first apply of the platform unit fails with `already exists`:

       cd platform
       terragrunt import 'google_secret_manager_secret.shared["f1v-api-openf1-login-user-email"]'    projects/<project>/secrets/f1v-api-openf1-login-user-email
       terragrunt import 'google_secret_manager_secret.shared["f1v-api-openf1-login-user-password"]' projects/<project>/secrets/f1v-api-openf1-login-user-password

6. **Point DNS at the load balancers.** A Google-managed certificate stays in
   PROVISIONING until the domain resolves to the forwarding rule's address, so
   the first apply of a new environment will show a certificate that is not
   ready. Both units output both addresses:

       terragrunt output static_ip     # A record
       terragrunt output static_ipv6   # AAAA record (SEC-5)

   The IPv6 address is reserved and serving whether or not an AAAA record points
   at it; until one does, IPv6-only clients simply cannot reach the site, which
   is the state before this change.

7. **Apply the platform layer.** `cd platform && terragrunt apply`. This enables
   the remaining APIs, creates the registries and the DNS zone, and turns on Data
   Access audit logging.

8. **Apply the environment.** `terragrunt run --all -- apply` from
   `environments/<env>`.

## Identities

SEC-1 split the single `sa-f1v-cloudbuild-<env>` account in two:

| Account | Runs | Holds |
|---|---|---|
| `sa-f1v-deploy-<env>` | `backend-service.yaml`, `frontend.yaml` | `run.developer`, `run.viewer`, `logging.logWriter`, `artifactregistry.writer` on the repository, `serviceAccountUser` per runtime account |
| `sa-f1v-infra-<env>` | `infrastructure.yaml` | The resource-admin roles in `iam-and-secrets/main.tf`, plus `projectIamAdmin` conditioned to the roles this repository declares |

The deploy account runs third-party build code (`./mvnw verify`, `yarn install`
with lifecycle scripts) and therefore holds no IAM, network or data
administration at all.

### Migrating an existing environment

The old account is removed by the same apply that creates the new ones, so do
this in order:

1. Apply `iam-and-secrets` — this creates both new accounts and deletes
   `sa-f1v-cloudbuild-<env>`.
2. Apply `cloudbuild-triggers` — this repoints every trigger.
3. Confirm one build of each pipeline succeeds before merging to the next branch.

A build already running when step 1 lands will fail on its next API call. Run the
migration when nothing is in flight.
