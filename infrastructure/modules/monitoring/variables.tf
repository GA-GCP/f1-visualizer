variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "environment" {
  description = "The environment (dev, uat, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "uat", "prod"], var.environment)
    error_message = "environment must be dev, uat or prod."
  }
}

variable "notification_emails" {
  description = "Addresses that receive alerts. An empty list creates the policies with no channel, which is a silent alert — set at least one for prod."
  type        = list(string)
  default     = []
}

variable "frontend_domain" {
  description = "Host the frontend uptime check probes (e.g. dev.f1visualizer.com)"
  type        = string
}

variable "api_domain" {
  description = "Host the API uptime check probes (e.g. dev.api.f1visualizer.com)"
  type        = string
}

variable "redis_instance_id" {
  description = "Memorystore instance id the cache alerts filter on (e.g. f1v-redis-dev)"
  type        = string
}

variable "billing_account" {
  description = "Billing account id (e.g. 01ABCD-234567-89EFGH). Empty means no budget is created — the budget needs an account this repository cannot discover."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly budget for this environment, in USD. Alerts fire at 50, 90 and 100 percent."
  type        = number
  default     = 400
}

variable "alerts_enabled" {
  description = "Whether the alert policies are enabled. Off in dev by default: an environment with no users overnight generates noise, not signal."
  type        = bool
  default     = true
}
