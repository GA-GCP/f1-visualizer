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

variable "connector_cidr" {
  description = "IP CIDR range for the Serverless VPC Access Connector (must be unique per project)"
  type        = string
  default     = "10.8.0.0/28"
}