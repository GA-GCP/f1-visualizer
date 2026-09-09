# ==============================================================================
# Platform layer
# ==============================================================================
# CPLX-2: everything here is shared by dev, uat and prod. It used to live inside
# environments/dev (the registry, the dataset) or outside the repository
# entirely (the APIs, the state bucket, the DNS zone, the audit configuration).
#
# This is deliberately outside environments/, so `terragrunt run --all` in an
# environment cannot apply or destroy it. Applying it is a separate, rarer act:
#
#     cd infrastructure/platform && terragrunt apply
#
# See infrastructure/README.md for the imports a project that already exists
# needs before the first apply.
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: production pulls its images from a repository declared here, and this
# unit owns the bucket every other unit's state lives in.
prevent_destroy = true

terraform {
  source = "../modules/platform"
}

inputs = {
  project_id = "f1v-example-project"

  # SEC-7: the bucket root.hcl already writes state into. Import it before the
  # first apply — this resource describes the bucket it is stored in.
  state_bucket          = "f1v-example-project-tfstate"
  state_bucket_location = "us-central1"

  # CPLX-2: dev and prod share us-central1, uat is in us-east1. Two repositories,
  # one id, and the writers are named per repository rather than through a
  # project-level roles/artifactregistry.writer (SEC-1).
  repository_id = "f1v-repo"

  registries = {
    us-central1 = {
      location = "us-central1"
      writer_members = [
        "serviceAccount:sa-f1v-deploy-dev@f1v-example-project.iam.gserviceaccount.com",
        "serviceAccount:sa-f1v-deploy-prod@f1v-example-project.iam.gserviceaccount.com",
      ]
    }
    us-east1 = {
      location = "us-east1"
      writer_members = [
        "serviceAccount:sa-f1v-deploy-uat@f1v-example-project.iam.gserviceaccount.com",
      ]
    }
  }

  # OPS-4: see the module. Turning this on means the pipeline must stop pushing
  # latest-<env>, so it is a separate, deliberate change.
  immutable_tags = false

  # SEC-6: OpenF1 issues one account, so this is one credential for all three
  # environments. Declared once here rather than three times.
  shared_secret_ids = [
    "f1v-api-openf1-login-user-email",
    "f1v-api-openf1-login-user-password",
  ]

  shared_secret_accessors = [
    "serviceAccount:sa-f1v-data-ingestion-dev@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-ingestion-uat@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-ingestion-prod@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-dev@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-uat@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-prod@f1v-example-project.iam.gserviceaccount.com",
  ]

  # OPS-3: the zone the managed certificates have always silently depended on.
  # The records live with the load balancers that own the addresses.
  dns_zone_name = "f1visualizer-com"
  dns_domain    = "f1visualizer.com"

  # OPS-3: 30 days is the platform default and is shorter than most questions
  # worth asking about an access.
  log_retention_days = 90

  # SEC-9: needs an organization. A standalone project cannot set these and the
  # apply fails rather than warning, so it is opt-in. If there is no
  # organization, that is an accepted gap and this line is where it is recorded.
  org_policies_enabled = false

  # DLV-1: federation for the pull-request plan. After applying, set the two
  # outputs as repository variables:
  #
  #   gh variable set WIF_PROVIDER            --body "$(terragrunt output -raw wif_provider)"
  #   gh variable set PLANNER_SERVICE_ACCOUNT --body "$(terragrunt output -raw planner_service_account)"
  github_repository = "GA-GCP/f1-visualizer"
}
