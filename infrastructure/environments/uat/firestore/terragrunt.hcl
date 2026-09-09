include "root" {
  path = find_in_parent_folders("root.hcl")
}

# CPLX-3: the definition lives in _envcommon and the environment's facts live in
# env.hcl. Anything below this is a real difference, not a copy.
include "envcommon" {
  path           = "${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/firestore.hcl"
  merge_strategy = "deep"
  expose         = true
}

# REL-9: a short retention so a bad UAT load can be undone, without paying for
# the PITR write window.
inputs = {
  backup_retention_days = 3
}
