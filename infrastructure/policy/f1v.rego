# DLV-3: the rules that would have caught findings in this audit, expressed so
# they cannot come back.
#
# Run against a rendered plan (`tofu show -json`), not against the modules — the
# module scan cannot see values that arrive as Terragrunt inputs, which is every
# security-relevant decision in this tree (DLV-4).
#
#   conftest test --policy infrastructure/policy plan.json
package main

import rego.v1

resources contains r if {
	some r in input.resource_changes
	r.change.after != null
}

# ---------------------------------------------------------------------------
# SEC-3: data and secret roles must be granted on the resource, not the project.
# dev, uat and prod share one project, so a project-level grant crosses every
# environment boundary in the estate.
# ---------------------------------------------------------------------------
resource_scoped_roles := {
	"roles/secretmanager.secretAccessor",
	"roles/bigquery.dataEditor",
	"roles/bigquery.dataViewer",
	"roles/bigquery.admin",
	"roles/datastore.owner",
}

deny contains msg if {
	some r in resources
	r.type == "google_project_iam_member"
	r.change.after.role in resource_scoped_roles
	not r.change.after.condition
	msg := sprintf(
		"SEC-3: %s grants %s at project level. Grant it on the secret or dataset, or attach an IAM condition.",
		[r.address, r.change.after.role],
	)
}

# ---------------------------------------------------------------------------
# SEC-1: roles that can escalate to control of the project.
# ---------------------------------------------------------------------------
forbidden_roles := {"roles/owner", "roles/editor", "roles/iam.serviceAccountKeyAdmin"}

deny contains msg if {
	some r in resources
	r.type in {"google_project_iam_member", "google_project_iam_binding"}
	r.change.after.role in forbidden_roles
	msg := sprintf("SEC-1: %s grants %s. Nothing in this estate needs it.", [r.address, r.change.after.role])
}

# ---------------------------------------------------------------------------
# SEC-2 / CPLX-4: a Cloud Run service must name the identity it runs as, or it
# silently falls back to the default compute account.
# ---------------------------------------------------------------------------
deny contains msg if {
	some r in resources
	r.type == "google_cloud_run_v2_service"
	some t in r.change.after.template
	not t.service_account
	msg := sprintf("SEC-2: %s does not set template.service_account.", [r.address])
}

# ---------------------------------------------------------------------------
# S3 / SEC-10: allUsers is allowed only where a serverless NEG needs it, and
# only on a service whose ingress keeps the *.run.app URL closed.
# ---------------------------------------------------------------------------
public_invoker contains r.address if {
	some r in resources
	r.type in {"google_cloud_run_v2_service_iam_member", "google_cloud_run_service_iam_member"}
	r.change.after.member == "allUsers"
}

allowed_public := {"f1v-webapp", "f1v-service-telemetry", "f1v-service-user", "f1v-service-data-analysis", "f1v-service-data-ingestion"}

deny contains msg if {
	some r in resources
	r.type in {"google_cloud_run_v2_service_iam_member", "google_cloud_run_service_iam_member"}
	r.change.after.member == "allUsers"
	not startswith_any(r.change.after.name, allowed_public)
	msg := sprintf("SEC-10: %s makes %s public. Add it to the allow-list in policy/f1v.rego and say why.", [r.address, r.change.after.name])
}

startswith_any(s, prefixes) if {
	some p in prefixes
	startswith(s, p)
}

# ---------------------------------------------------------------------------
# REL-1: IaC must not name a floating image tag. The pipeline owns the image;
# a tag resolved at apply time is how a dev build reached prod.
# ---------------------------------------------------------------------------
deny contains msg if {
	some r in resources
	r.type == "google_cloud_run_v2_service"
	some t in r.change.after.template
	some c in t.containers
	endswith(c.image, ":latest")
	msg := sprintf("REL-1: %s uses a bare :latest tag. Use latest-<env> or a digest.", [r.address])
}

# ---------------------------------------------------------------------------
# REL-8: production resources that can be deleted without a prompt.
# ---------------------------------------------------------------------------
deny contains msg if {
	some r in resources
	r.type == "google_cloud_run_v2_service"
	endswith(r.change.after.name, "-prod")
	not r.change.after.deletion_protection
	msg := sprintf("REL-8: %s is a prod service without deletion_protection.", [r.address])
}

deny contains msg if {
	some r in resources
	r.type == "google_firestore_database"
	endswith(r.change.after.name, "-prod")
	r.change.after.delete_protection_state != "DELETE_PROTECTION_ENABLED"
	msg := sprintf("REL-8: %s is a prod database without delete protection.", [r.address])
}

# ---------------------------------------------------------------------------
# SEC-5: no target proxy on the default SSL policy, which permits TLS 1.0.
# ---------------------------------------------------------------------------
deny contains msg if {
	some r in resources
	r.type == "google_compute_target_https_proxy"
	not r.change.after.ssl_policy
	msg := sprintf("SEC-5: %s uses the default SSL policy, which permits TLS 1.0.", [r.address])
}

# ---------------------------------------------------------------------------
# OPS-2: a backend service with no request logging is a blind edge.
# ---------------------------------------------------------------------------
deny contains msg if {
	some r in resources
	r.type == "google_compute_backend_service"
	count([c | some c in r.change.after.log_config; c.enable]) == 0
	msg := sprintf("OPS-2: %s has no log_config { enable = true }.", [r.address])
}
