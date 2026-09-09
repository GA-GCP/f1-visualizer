include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: this unit lives under environments/{env} but the resource it declares is
# shared by all three environments — prod pulls its images from here. Until
# CPLX-2 moves it into the platform layer, `run --all destroy` in this
# environment would take production's registry with it.
prevent_destroy = true

terraform {
  source = "../../../modules/artifact-registry"
}

inputs = {
  project_id    = "f1v-example-project"
  location      = "us-east1"
  repository_id = "f1v-repo"
  environment   = "uat"

  # SEC-1: repository-scoped push, replacing a project-level
  # roles/artifactregistry.writer. uat is the only environment that uses this
  # repository.
  writer_members = [
    "serviceAccount:sa-f1v-deploy-uat@f1v-example-project.iam.gserviceaccount.com",
  ]
}
