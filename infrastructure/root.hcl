# ==============================================================================
# Root configuration, included by every unit
# ==============================================================================
# CPLX-3: this file used to generate a provider with the project and region
# written into it as literals, while each of the 48 units repeated the same
# facts — the project id appeared 116 times across the tree, us-central1 54
# times, the Auth0 tenant 18, the Firestore database id 12. REL-2 is what that
# looks like in practice: one of three copies of a unit kept the wrong region and
# nobody could see it.
#
# Environment facts are now stated once, in environments/<env>/env.hcl, and read
# here. `platform/` has no env.hcl above it, which is why the lookup has a
# fallback rather than an error.

terraform_binary = "tofu"

locals {
  # `platform/` has no env.hcl above it and must still resolve.
  #
  # try(), not a conditional on an empty path: HCL evaluates both arms of a
  # conditional to unify their types, so `"" == "" ? {} : read_terragrunt_config("")`
  # still called read_terragrunt_config with an empty path in the platform unit,
  # which resolves to the unit's own terragrunt.hcl, which includes this file —
  # an include loop that Terragrunt spun on silently. The platform unit could
  # never be parsed, let alone applied.
  env = try(read_terragrunt_config(find_in_parent_folders("env.hcl")).locals, {})

  project_id = read_terragrunt_config(find_in_parent_folders("project.hcl")).locals.project_id
  region     = try(local.env.region, "us-central1")

  # `platform` is not an environment, but it is a legible label for the
  # resources that belong to no single one.
  environment = try(local.env.environment, "platform")

  # CPLX-5: nothing outside redis, bigquery and the registry carried a label, so
  # the largest line items in the bill — Cloud Run, the load balancers, the VPC —
  # could not be split by environment at all. `default_labels` on the provider
  # applies these to every labelable resource with no module change, and is what
  # makes the per-environment budget filter in the monitoring module work.
  labels = {
    app        = "f1v"
    env        = local.environment
    managed_by = "terragrunt"
  }
}

# ==============================================================================
# Remote state
# ==============================================================================
remote_state {
  backend = "gcs"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    # SEC-7: this bucket is declared in infrastructure/platform. It has to exist
    # before any unit can store state, including the one that declares it, so it
    # is created by hand and imported once — see MIGRATIONS.md.
    bucket   = "${local.project_id}-tfstate"
    prefix   = "${path_relative_to_include()}/terraform.tfstate"
    project  = local.project_id
    location = "us-central1"
  }
}

# ==============================================================================
# Provider
# ==============================================================================
# CPLX-5: google-beta used to be pulled in unconstrained by the api-gateway
# module, which declared neither the provider nor a version — `tofu init`
# resolved "latest" for it and it inherited no project or region. The gateway is
# gone (CPLX-1) and nothing uses beta now, so there is one provider block.
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-PROVIDER
    provider "google" {
      project = "${local.project_id}"
      region  = "${local.region}"

      default_labels = ${jsonencode(local.labels)}
    }
  PROVIDER
}

# ==============================================================================
# Runtime behaviour (DLV-7)
# ==============================================================================
terraform {
  # A concurrent human `plan` used to fail the pipeline instead of waiting for
  # the state lock.
  extra_arguments "locking" {
    commands  = get_terraform_commands_that_need_locking()
    arguments = ["-lock-timeout=10m"]
  }
}

# The Google API answers 409 while a resource it just created settles, and 429
# under the parallelism the pipeline now uses (PERF-5). Both were a failed apply
# that needed a human to re-run it.
errors {
  retry "transient_google_api" {
    retryable_errors = [
      "(?s).*Error 409.*try again.*",
      "(?s).*Error 429.*",
      "(?s).*rateLimitExceeded.*",
      "(?s).*is not ready.*",
      "(?s).*connection reset by peer.*",
      "(?s).*TLS handshake timeout.*",
    ]
    max_attempts       = 3
    sleep_interval_sec = 10
  }
}

# Every unit takes these; an environment or unit adds only what differs.
inputs = {
  project_id = local.project_id
}
