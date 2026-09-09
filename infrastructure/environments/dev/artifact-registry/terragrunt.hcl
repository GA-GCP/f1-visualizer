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
  project_id    = "f1-visualizer-488201"
  location      = "us-central1"
  repository_id = "f1v-repo"
  environment   = "dev"

  # SEC-1: repository-scoped push, replacing a project-level
  # roles/artifactregistry.writer.
  #
  # prod has no registry of its own — it pulls from this one — so prod's deploy
  # identity is listed here too. It is written out rather than read from a
  # `dependency`, because a dependency on ../../prod/iam-and-secrets would pull
  # the prod unit into `run --all` from environments/dev. CPLX-2 removes the
  # awkwardness by moving this repository into a platform layer that both
  # environments depend on.
  writer_members = [
    "serviceAccount:sa-f1v-deploy-dev@f1-visualizer-488201.iam.gserviceaccount.com",
    "serviceAccount:sa-f1v-deploy-prod@f1-visualizer-488201.iam.gserviceaccount.com",
  ]
}
