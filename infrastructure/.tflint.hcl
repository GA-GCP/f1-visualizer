# DLV-3: tflint with the Google ruleset, which catches invalid machine types,
# malformed resource names and deprecated arguments that `tofu validate` accepts
# because they are only wrong at the API.
tflint {
  required_version = ">= 0.50"
}

plugin "google" {
  enabled = true
  version = "0.34.0"
  source  = "github.com/terraform-linters/tflint-ruleset-google"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

rule "terraform_required_version" {
  enabled = true
}

rule "terraform_required_providers" {
  enabled = true
}

# Every variable carries a description and a type after CPLX-6; this keeps it so.
rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

rule "terraform_typed_variables" {
  enabled = true
}

rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}
