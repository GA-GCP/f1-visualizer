include "root" {
  path = find_in_parent_folders("root.hcl")
}

# CPLX-3: the definition lives in _envcommon and the environment's facts live in
# env.hcl. Anything below this is a real difference, not a copy.
include "envcommon" {
  path           = "${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/cloudbuild-triggers.hcl"
  merge_strategy = "deep"
  expose         = true
}
