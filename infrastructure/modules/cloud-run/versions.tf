# Pins the toolchain and provider versions this module is built against.
# Without these, every `tofu init` silently tracks provider latest.
terraform {
  # DLV-5: ">= 1.12.0" is open-ended while CI pins 1.12.6, so a contributor's
  # local tofu was whatever they happened to install. mise.toml pins the same
  # version this allows.
  required_version = "~> 1.12"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.1"
    }
  }
}
