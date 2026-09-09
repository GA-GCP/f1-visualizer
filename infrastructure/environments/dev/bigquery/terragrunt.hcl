include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: this unit lives under environments/{env} but the resource it declares is
# shared by all three environments — prod pulls its images from here. Until
# CPLX-2 moves it into the platform layer, `run --all destroy` in this
# environment would take production's registry with it.
prevent_destroy = true

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1v-example-project"
  environment = "dev"
  location    = "US"

  # SEC-3: roles/bigquery.dataEditor and roles/bigquery.dataViewer were project
  # level, so every BigQuery identity could reach every dataset. Granted here on
  # the dataset instead.
  #
  # All three environments are listed because all three read and write this one
  # dataset — which is CPLX-2's point, and the reason a UAT historical load
  # writes into the tables prod reads. The members are written out rather than
  # read from a `dependency`, because depending on ../../prod/iam-and-secrets
  # would pull prod's unit into `run --all` from environments/dev. Per-environment
  # datasets remove both problems.
  dataset_editors = [
    "serviceAccount:sa-f1v-data-ingestion-dev@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-ingestion-uat@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-ingestion-prod@f1v-example-project.iam.gserviceaccount.com",
  ]

  dataset_viewers = [
    "serviceAccount:sa-f1v-data-analysis-dev@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-analysis-uat@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-data-analysis-prod@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-dev@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-uat@f1v-example-project.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-replay-worker-prod@f1v-example-project.iam.gserviceaccount.com",
  ]
}
