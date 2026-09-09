output "notification_channel_ids" {
  description = "Channels the alert policies notify. Empty means the policies exist but nothing is told when they fire."
  value       = local.channels
}
