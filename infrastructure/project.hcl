# The one GCP project that dev, uat and prod share. It is not an environment
# fact, so it is not in env.hcl: root.hcl, every env.hcl and the platform unit
# read it from here, and the service-account emails, registry path and state
# bucket are derived from it. A fork changes this line and nothing else.
#
# The committed value is a placeholder. The project this repository was built
# against has been torn down (see the README's Status section); the identifier
# is not a secret, it is simply not this repository's to publish.
locals {
  project_id = "f1v-example-project"
}
