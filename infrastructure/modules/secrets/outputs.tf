output "openf1_username_secret_id" {
  description = "Secret holding the OpenF1 login email. Mount as F1V_OPENF1_USERNAME."
  value       = google_secret_manager_secret.openf1_username.secret_id
}

output "openf1_password_secret_id" {
  description = "Secret holding the OpenF1 login password. Mount as F1V_OPENF1_PASSWORD."
  value       = google_secret_manager_secret.openf1_password.secret_id
}
