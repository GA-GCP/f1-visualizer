include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true

terraform {
  source = "../../../modules/cloud-run-frontend"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_frontend_email = "sa-f1v-frontend-prod@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-webapp-prod"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/frontend:latest-prod"

  # REL-8: the five prod backend services and prod Firestore set this; the prod
  # webapp never did, and the module defaults it to false for dev/uat agility.
  deletion_protection = true

  # SEC-2: the isolated frontend identity, which holds no IAM bindings anywhere.
  # Without it Cloud Run falls back to the default compute service account.
  service_account_email = dependency.iam.outputs.sa_frontend_email

  # IMPORTANT: This makes the React app accessible to the internet
  is_public = true
}
