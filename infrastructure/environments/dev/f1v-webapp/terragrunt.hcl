include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-frontend"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_frontend_email = "sa-f1v-frontend-dev@f1-visualizer-488201.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-webapp-dev"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/frontend:latest-dev"

  # SEC-2: the isolated frontend identity, which holds no IAM bindings anywhere.
  # Without it Cloud Run falls back to the default compute service account.
  service_account_email = dependency.iam.outputs.sa_frontend_email
}
