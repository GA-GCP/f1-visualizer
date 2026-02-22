variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (e.g., dev, uat, prod)"
  type        = string
}

variable "region" {
  description = "The GCP region for the subnets"
  type        = string
}

variable "network_name" {
  description = "The name of the VPC network"
  type        = string
}