include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-frontend"
}

inputs = {
  project_id             = "f1-visualizer-uat"
  region                 = "us-central1"
  name_prefix            = "f1v-frontend-uat"
  domain                 = "uat.f1visualizer.com"
  cloud_run_service_name = "f1v-webapp-uat"
}
