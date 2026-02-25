include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../modules/api-gateway"
}

inputs = {
  project_id = "f1-visualizer-488201"
  region     = "us-central1"
  gateway_id = "f1v-gateway-dev"

  # Placeholder Spec - We will overwrite this via CI/CD later using 'gcloud api-gateway api-configs create'
  openapi_spec = <<EOF
swagger: '2.0'
info:
  title: F1 Visualizer API (Placeholder)
  description: Initial placeholder configuration
  version: 1.0.0
schemes:
  - https
paths:
  /health:
    get:
      summary: Health Check
      operationId: healthCheck
      responses:
        '200':
          description: OK
EOF
}