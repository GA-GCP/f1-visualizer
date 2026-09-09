variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for every resource this module creates (e.g. f1v-api-dev)"
  type        = string
}

variable "region" {
  description = "GCP region of the Cloud Run services the serverless NEGs point at. Must match the services' own region."
  type        = string
}

variable "domain" {
  description = "Domain the managed certificate is issued for (e.g. dev.api.f1visualizer.com)"
  type        = string
}

variable "frontend_origin" {
  description = "Origin allowed by the edge CORS policy (e.g. https://dev.f1visualizer.com)"
  type        = string

  validation {
    condition     = startswith(var.frontend_origin, "https://")
    error_message = "frontend_origin must be a full https:// origin, since it is compared against the browser's Origin header verbatim."
  }
}

variable "user_service_name" {
  description = "Cloud Run service name serving /api/v1/users"
  type        = string
}

variable "analysis_service_name" {
  description = "Cloud Run service name serving /api/v1/analysis"
  type        = string
}

variable "ingestion_service_name" {
  description = "Cloud Run service name serving /api/v1/ingestion"
  type        = string
}

variable "telemetry_service_name" {
  description = "Cloud Run service name serving the /ws WebSocket route"
  type        = string
}
