include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-frontend"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-webapp-uat"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/frontend:latest-uat"

  # IMPORTANT: This makes the React app accessible to the internet
  is_public    = true
}
