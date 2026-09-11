# Migrations

Changes in this repository that cannot be completed by an apply alone. Each is
written so it can be executed without reading the commit that introduced it.

---

## 1. Import the resources the platform layer now declares

**Why:** CPLX-2, SEC-7 and OPS-3 moved shared resources into
`infrastructure/platform/`, and OPS-3 declared project-level plumbing that has
always existed as console state. Terraform does not adopt an existing resource —
the first apply fails with `already exists` until it is imported.

**When:** once, before the first `terragrunt apply` in `infrastructure/platform`.

```bash
cd infrastructure/platform
P=f1v-example-project   # project_id from project.hcl

# The bucket this unit's own state is stored in (SEC-7).
terragrunt import 'google_storage_bucket.tfstate' "$P/$P-tfstate"

# The two Artifact Registry repositories, previously declared in environments/.
terragrunt import 'google_artifact_registry_repository.repo["us-central1"]' \
  "projects/$P/locations/us-central1/repositories/f1v-repo"
terragrunt import 'google_artifact_registry_repository.repo["us-east1"]' \
  "projects/$P/locations/us-east1/repositories/f1v-repo"

# The OpenF1 credentials, created by hand before they were declared (SEC-6).
terragrunt import 'google_secret_manager_secret.shared["f1v-api-openf1-login-user-email"]' \
  "projects/$P/secrets/f1v-api-openf1-login-user-email"
terragrunt import 'google_secret_manager_secret.shared["f1v-api-openf1-login-user-password"]' \
  "projects/$P/secrets/f1v-api-openf1-login-user-password"

# The DNS zone, if one already exists under this name.
terragrunt import 'google_dns_managed_zone.primary[0]' "$P/f1visualizer-com"
```

`google_project_service` entries for APIs that are already enabled are adopted
without an import — the provider treats enabling an enabled API as a no-op.

**Then, in each environment**, remove the now-moved units from state rather than
letting a destroy plan delete production's registry:

```bash
cd infrastructure/environments/dev
terragrunt state rm google_artifact_registry_repository.repo   # in the old artifact-registry unit
```

The old `environments/*/artifact-registry` and `environments/*/secrets`
directories are deleted in this branch, so their state objects are orphaned
rather than destroyed. Delete them from the bucket once the platform apply is
confirmed:

```bash
gsutil rm -r gs://$P-tfstate/dev/artifact-registry
gsutil rm -r gs://$P-tfstate/uat/artifact-registry
```

---

## 2. Split the BigQuery dataset per environment

**Why:** CPLX-2. One dataset, `f1_dataset`, declared only in `environments/dev`,
was read and written by all three environments. A UAT historical load wrote into
the tables prod reads, and a dev destroy would have taken them. The backend has
honoured `F1V_BIGQUERY_DATASET` since C4; nothing set it, so every environment
fell through to the same default.

**After this branch**, each environment declares `f1_dataset_<env>` and sets
`F1V_BIGQUERY_DATASET` on analysis, ingestion and the replay worker.

**The tables are created empty.** Production's rows are still in `f1_dataset` and
have to be copied. Do this with prod ingestion paused — a load in flight would
write into the old dataset after the copy starts.

```bash
P=f1v-example-project   # project_id from project.hcl

# 1. Apply the three bigquery units so the empty datasets and tables exist.
#    (dev first, then uat, then prod, in the normal promotion order.)

# 2. Copy production's rows. CREATE TABLE ... COPY preserves partitioning,
#    clustering and require_partition_filter; a SELECT INTO does not.
for t in laps telemetry drivers sessions locations results session_drivers driver_stats; do
  bq --project_id="$P" query --use_legacy_sql=false \
    "CREATE TABLE \`$P.f1_dataset_prod.$t\` COPY \`$P.f1_dataset.$t\`"
done

# 3. Confirm the row counts match before anything reads the new dataset.
for t in laps telemetry drivers sessions locations results session_drivers driver_stats; do
  echo -n "$t: "
  bq --project_id="$P" query --use_legacy_sql=false --format=csv \
    "SELECT (SELECT COUNT(*) FROM \`$P.f1_dataset.$t\`) AS old,
            (SELECT COUNT(*) FROM \`$P.f1_dataset_prod.$t\`) AS new" | tail -1
done
```

Step 2 fails on a table that already exists, which is the desired behaviour —
`CREATE TABLE ... COPY` will not silently merge into a dataset that has already
taken writes.

**Repeat for uat** if its data is worth keeping. Dev's is reloadable from OpenF1
and is not worth copying.

**Only then** deploy the services that read `F1V_BIGQUERY_DATASET`. The
infrastructure apply sets the variable, so the copy must be complete before that
apply reaches prod.

**Afterwards**, `f1_dataset` is unreferenced. Leave it for a release as a
rollback, then delete it:

```bash
bq --project_id="$P" rm -r -f -d "$P:f1_dataset"
```

---

## 3. Cut over to Certificate Manager

**Why:** SEC-5. `google_compute_managed_ssl_certificate` is the classic type —
one domain per certificate, no way to add `www` without a second certificate and
proxy slot, and validation that requires the load balancer to already answer on
the domain.

**Both certificates exist after an apply.** The Certificate Manager one validates
through the DNS authorization CNAME, which the load balancer units create in the
zone, while the classic one keeps serving. Nothing switches until the flag does.

```bash
# 1. After applying an environment, wait for the certificate to go ACTIVE.
gcloud certificate-manager certificates describe f1v-frontend-dev-cert-managed \
  --location=global --project="$P" --format='value(managed.state)'

# 2. Only when it reports ACTIVE, set use_certificate_manager = true in that
#    environment's lb-frontend and lb-api units, and apply.
```

Do dev first and leave it for a day. Pointing a live proxy at a certificate map
whose certificate is still PROVISIONING takes HTTPS down for that domain.

---

## 4. Move Cloud Build to a managed repository connection

**Why:** CPLX-8. The triggers use the first-generation `github {}` block, whose
repository connection was created by hand in the console. It is unmanaged state
that nothing in this repository records, and a new project cannot reproduce it.

**Both generations are implemented.** The triggers keep the first-generation
block while `cloudbuild_repository_id` is empty, which it is.

```bash
P=f1v-example-project   # project_id from project.hcl

# 1. Install the Cloud Build GitHub App on the repository and note the
#    installation id from the URL of the app's settings page.
#    https://github.com/settings/installations

# 2. Put a PAT with `repo` scope in Secret Manager and grant the Cloud Build
#    service agent access to it.
printf '%s' "$GITHUB_PAT" | gcloud secrets create f1v-github-token --data-file=- --project="$P"
gcloud secrets add-iam-policy-binding f1v-github-token --project="$P" \
  --member="serviceAccount:service-$(gcloud projects describe "$P" --format='value(projectNumber)')@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

# 3. Set both values in infrastructure/platform/terragrunt.hcl and apply:
#      github_app_installation_id  = "<installation id>"
#      github_token_secret_version = "projects/<number>/secrets/f1v-github-token/versions/1"
cd infrastructure/platform && terragrunt apply

# 4. Take the repository id and set cloudbuild_repository_id in
#    _envcommon/cloudbuild-triggers.hcl, then apply one environment at a time.
terragrunt output -raw cloudbuild_repository_id
```

Applying step 4 replaces every trigger, because the event source is not an
in-place change. Do dev first and confirm a push still builds before promoting.

---

## 5. Switch the CI identities

See **Migrating an existing environment** in `README.md`. `sa-f1v-cloudbuild-<env>`
is deleted by the same apply that creates `sa-f1v-deploy-<env>` and
`sa-f1v-infra-<env>`, so the iam unit and the triggers unit must be applied in
that order, with no build in flight.
