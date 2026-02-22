# 1. Override Terraform to use OpenTofu
terraform_binary = "tofu"

# 2. Configure the Remote GCS Backend
remote_state {
  backend = "gcs"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    # Replace this with a globally unique bucket name (e.g., your project ID + "tfstate")
    bucket   = "f1v-example-project-tfstate"
    prefix   = "${path_relative_to_include()}/terraform.tfstate"
    project  = "f1v-example-project"
    location = "us-central1"
  }
}

# 3. Global Provider Configuration (Optional but recommended)
# This forces every module to use the GCP provider automatically.
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "google" {
  project = "f1v-example-project"
  region  = "us-central1"
}
EOF
}