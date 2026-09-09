include "root" {
  path = find_in_parent_folders("root.hcl")
}

# CPLX-3: the definition lives in _envcommon and the environment's facts live in
# env.hcl. Anything below this is a real difference, not a copy.
include "envcommon" {
  path           = "${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/networking.hcl"
  merge_strategy = "deep"
  expose         = true
}

# REL-8: a unit rename, a module path change or a stray `run --all destroy` all
# plan a destroy without a prompt. Terragrunt refuses to run one here at all;
# removing this line is the deliberate act that a production teardown should be.
prevent_destroy = true
