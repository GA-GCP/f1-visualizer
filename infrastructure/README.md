# Infrastructure

OpenTofu modules under `modules/`, one Terragrunt unit per resource per
environment under `environments/<env>/`. `cloudbuild/infrastructure.yaml` plans
and applies an environment on a push to that environment's branch.

## Bootstrap order

REL-4: the pipeline identity cannot create everything the code declares, and it
never could — a human with Owner created the first copy of each of these, and
that was written down nowhere. This is that order. Everything below is a
one-time, out-of-band step for a project that does not exist yet.

1. **Enable the APIs.** `run`, `artifactregistry`, `cloudbuild`, `compute`,
   `redis`, `bigquery`, `firestore`, `secretmanager`, `vpcaccess`, `iam`,
   `cloudresourcemanager`, `monitoring`, `logging`, `dns`, `storage`.
   OPS-3 moves these into a platform layer; until then they are console state.

2. **Create the state bucket.** `gs://<project>-tfstate`, with versioning on,
   uniform bucket-level access, and `public_access_prevention = enforced`.
   `root.hcl` expects it to exist. SEC-7 covers what it should be configured as.

3. **Apply the `iam-and-secrets` unit as a human with Owner.** It creates the two
   CI identities that everything else runs as, so it cannot create itself:

       cd environments/<env>/iam-and-secrets && terragrunt apply

4. **Create the Cloud Build GitHub connection** in the console and authorise the
   repository. The triggers use the first-generation `github {}` block, whose
   connection is not a Terraform resource (CPLX-8).

5. **Create the shared secrets.** `f1v-api-openf1-login-user-email` and
   `f1v-api-openf1-login-user-password`. SEC-6 declares the containers in IaC;
   the values are added out of band so they never enter state.

6. **Point DNS at the load balancers.** A Google-managed certificate stays in
   PROVISIONING until the domain resolves to the forwarding rule's address, so
   the first apply of a new environment will show a certificate that is not
   ready. `terragrunt output static_ip` in `lb-api` and `lb-frontend`.

7. **Apply the rest.** `terragrunt run --all apply` from `environments/<env>`.

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
