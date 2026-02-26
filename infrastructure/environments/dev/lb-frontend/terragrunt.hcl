include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/lb-frontend"
}

inputs = {
  project_id             = "f1-visualizer-488201"
  region                 = "us-central1"
  name_prefix            = "f1v-frontend-dev"
  domain                 = "dev.f1visualizer.com"
  cloud_run_service_name = "f1v-webapp-dev"
}