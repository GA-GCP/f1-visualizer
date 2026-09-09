include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-frontend"
}

dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_frontend_email = "sa-f1v-frontend-uat@f1v-example-project.iam.gserviceaccount.com"
  }

  # REL-7: mocks are for planning, never for applying.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-east1"
  service_name = "f1v-webapp-uat"
  image_url    = "us-east1-docker.pkg.dev/f1v-example-project/f1v-repo/frontend:latest-uat"

  # SEC-2: the isolated frontend identity, which holds no IAM bindings anywhere.
  # Without it Cloud Run falls back to the default compute service account.
  service_account_email = dependency.iam.outputs.sa_frontend_email
}
