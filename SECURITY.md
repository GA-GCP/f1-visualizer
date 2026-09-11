# Security

This is a personal portfolio project. It is not deployed, and the cloud estate
its infrastructure code describes has been torn down; there is no running
service to attack, and no user data is held anywhere.

## Reporting

If you find something in the code that you believe would be exploitable in a
deployment — an authorization gap, an injection path, a misconfigured control
in the infrastructure modules — please report it privately through GitHub's
**Report a vulnerability** form on this repository's Security tab rather than
in a public issue. Reports are read and answered by the repository owner.

Please include the file and line, the commit you looked at, and what an
attacker would gain. A proof of concept against a local checkout is welcome;
there is no hosted target to test against.

## Scope

- `backend/` — the five Spring Boot services and four commons modules
- `frontend/` — the React single-page application
- `infrastructure/` — the OpenTofu modules and Terragrunt units
- `cloudbuild/` and `.github/` — the delivery pipelines

Only `main` is maintained. Dependency advisories are handled by Dependabot
and the `yarn audit`, Trivy and SBOM gates described in the README; there is no
need to report a published CVE in a pinned dependency unless the gates missed
it.

## What is already in place

The controls the code relies on are documented in the README's
[Security Architecture](README.md#security-architecture) section, and the
reviews that shaped them are in [`docs/audits/`](docs/audits/).
