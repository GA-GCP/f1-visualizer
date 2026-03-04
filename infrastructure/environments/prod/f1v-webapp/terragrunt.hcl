include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

inputs = {
  project_id   = "f1v-example-prod"
  region       = "us-central1"
  service_name = "f1v-webapp-prod"
  image_url    = "us-central1-docker.pkg.dev/f1v-example-prod/f1v-repo/frontend:latest"

  # IMPORTANT: This makes the React app accessible to the internet
  is_public    = true
}
