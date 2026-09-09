# Pins the toolchain and provider versions this module is built against.
# Without these, every `tofu init` silently tracks provider latest.
terraform {
  required_version = ">= 1.12.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.1"
    }
  }
}
