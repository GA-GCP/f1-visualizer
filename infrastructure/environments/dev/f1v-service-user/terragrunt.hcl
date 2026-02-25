include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/cloud-run"
}

inputs = {
  project_id   = "f1-visualizer-488201"
  region       = "us-central1"
  service_name = "f1v-service-user-dev"
  image_url    = "us-central1-docker.pkg.dev/f1-visualizer-488201/f1v-repo/user:latest"

  env_vars = {
    "SPRING_PROFILES_ACTIVE" = "dev"
  }
}