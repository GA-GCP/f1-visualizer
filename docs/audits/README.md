# Audits

Three end-to-end reviews, one per pillar of the monorepo, each written against a
named commit and then worked through. The finding IDs are the ones cited in code
comments, commit messages and the READMEs — `(R9)`, `(SEC-1)`, `(CPLX-2)` — so a
comment that says *why* a line exists can be followed back to the finding that
put it there.

| Date | Report | Scope | IDs |
|---|---|---|---|
| 2026-09-06 | [Frontend audit](2026-09-06-frontend-audit.md) | `frontend/` at `d8383ce` — 96 findings | `F001`–`F096`, grouped by theme; categories S1 performance, S2 fluidity, S3 enterprise |
| 2026-09-08 | [Backend architecture review](2026-09-08-backend-architecture-review.md) | `backend/` at `626176d` — 38 findings | `S` security, `R` reliability, `P` performance, `C` complexity, `T` testing, `O` operations |
| 2026-09-09 | [Infrastructure audit](2026-09-09-infrastructure-audit.md) | `infrastructure/` at `d901495` — 51 findings | `SEC`, `REL`, `PERF`, `CPLX`, `DLV`, `OPS` — prefixed so they never collide with the backend IDs |

Each report ends with a ranked roadmap; the commits that followed reference the
IDs they close. The infrastructure report's migration steps became
[`infrastructure/MIGRATIONS.md`](../../infrastructure/MIGRATIONS.md).

The reports are reproduced as written, at the commit they name, with one
substitution: the GCP project id they quote has been replaced by the placeholder
`f1v-example-project` used throughout the repository. Where the code
has since moved — the four services are five, the ten commons modules are four,
the API Gateway is gone — that is the roadmap having been executed, and the
current READMEs describe the result.
