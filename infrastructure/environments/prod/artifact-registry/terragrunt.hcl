include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/artifact-registry"
}

inputs = {
  project_id    = "f1-visualizer-prod"
  location      = "us-central1"
  repository_id = "f1v-repo"
  environment   = "prod"
}
