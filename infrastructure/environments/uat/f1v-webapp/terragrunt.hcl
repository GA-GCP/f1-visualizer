include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run-frontend"
}

inputs = {
  project_id   = "f1v-example-uat"
  region       = "us-central1"
  service_name = "f1v-webapp-uat"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-uat/f1v-repo/frontend:latest"

  # IMPORTANT: This makes the React app accessible to the internet
  is_public    = true
}
