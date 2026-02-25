variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "environment" {
  description = "Environment (dev, uat, prod)"
  type        = string
}

variable "network_id" {
  description = "The VPC Network ID to connect Redis to"
  type        = string
}