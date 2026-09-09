include "root" {
  path = find_in_parent_folders("root.hcl")
}

# REL-8: this unit lives under environments/{env} but the resource it declares is
# shared by all three environments — prod pulls its images from here. Until
# CPLX-2 moves it into the platform layer, `run --all destroy` in this
# environment would take production's registry with it.
prevent_destroy = true

terraform {
  source = "../../../modules/bigquery"
}

inputs = {
  project_id  = "f1-visualizer-488201"
  environment = "dev"
  location    = "US"
}