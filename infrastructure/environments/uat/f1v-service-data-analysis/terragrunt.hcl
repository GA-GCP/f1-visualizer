include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

# 1. Dependency on IAM module
dependency "iam" {
  config_path = "../iam-and-secrets"
  mock_outputs = {
    sa_data_analysis_email = "sa-f1v-data-analysis-uat@f1-visualizer-uat.iam.gserviceaccount.com"
  }
}

inputs = {
  project_id   = "f1-visualizer-uat"
  region       = "us-central1"
  service_name = "f1v-service-data-analysis-uat"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-uat/f1v-repo/data-analysis:latest"
  service_account_email = dependency.iam.outputs.sa_data_analysis_email

  is_public    = true

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "uat"

    # --- NEW: Explicitly inject Auth0 Security Properties ---
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI" = "https://uat-f1visualizer.us.auth0.com/"
    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES"  = "uat.api.f1visualizer.com"
  }
}
