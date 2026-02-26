include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam_and_secrets"
  mock_outputs = {
    sa_user_email = "sa-f1v-user-dev@f1v-example-project.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1v-example-project"
  region       = "us-central1"
  service_name = "f1v-service-user-dev"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-project/f1v-repo/user:latest"
  service_account_email = dependency.iam.outputs.sa_user_email

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "dev"
  }
}