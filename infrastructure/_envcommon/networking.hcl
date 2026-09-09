# ==============================================================================
# networking — one VPC and subnet per environment
# ==============================================================================
# CPLX-3: the shared definition. What differs per environment comes from env.hcl.

locals {
  env  = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
  root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.root}/modules/networking"
}

inputs = {
  # No `environment` here: every name in this module derives from network_name,
  # so the variable was declared and never read. tflint's
  # terraform_unused_declarations caught it (DLV-3).
  region       = local.env.region
  network_name = local.env.network_name

  # PERF-1: the range Cloud Run instances take an address on with direct VPC
  # egress. Each environment has its own VPC, so all three can use the same one.
  subnet_cidr = local.env.subnet_cidr
}
