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

  # BOOTSTRAP CONFIGURATION:
  # We use this simple "Health Check" spec just to get the infrastructure created.
  # The REAL routing spec (with Cloud Run backends) is injected later by the
  # 'cloudbuild/api-gateway.yaml' pipeline.
  openapi_spec = <<EOF
swagger: '2.0'
info:
  title: F1 Visualizer API (Bootstrap)
  description: Initial placeholder configuration to bootstrap the Gateway infrastructure.
  version: 1.0.0
schemes:
  - https
paths:
  /health:
    get:
      summary: Health Check
      operationId: healthCheck
      x-google-backend:
        address: https://placeholder.com
        path_translation: APPEND_PATH_TO_ADDRESS
      responses:
        '200':
          description: OK
EOF
}

