# Semgrep rules

Custom rules encoding invariants that are specific to this codebase — the things
no off-the-shelf linter knows, and that the 2026-09-08 backend review and the
2026-09-09 infrastructure audit found the hard way.

Everything else this repo checks is already covered elsewhere and is deliberately
not duplicated here:

| Concern | Tool |
|---|---|
| Java bugs and security | SpotBugs at `Max` effort + FindSecBugs |
| Java formatting | Spotless |
| TypeScript correctness | `tsc --noEmit`, ESLint `recommendedTypeChecked` |
| Dependency CVEs | Trivy, `yarn audit`, Dependabot |
| IaC posture | Trivy config, tflint, Conftest against a rendered plan |
| Workflow security | actionlint + shellcheck, zizmor |

## What is here

| Rule | Severity | Guards |
|---|---|---|
| `f1v-bigquery-bypasses-guardrails` | ERROR | Every query goes through `BigQueryQueryRunner`, which sets `setJobTimeoutMs` and `setMaximumBytesBilled` (C4, P2) |
| `f1v-bigquery-hardcoded-dataset` | ERROR | The dataset name comes from `BigQueryProperties.dataset()`, not a literal — CPLX-2 gave each environment its own |
| `f1v-no-cross-origin-annotation` | ERROR | CORS is answered at the load-balancer edge and configured once in commons-web |
| `f1v-permit-all-outside-commons` | ERROR | `permitAll()` belongs to the Actuator probes and the `/ws` handshake, nowhere else |
| `f1v-log-do-not-print` | WARNING | SLF4J, so the line carries the trace id and a severity (O2) |
| `f1v-auth-config-outside-env-module` | ERROR | Auth0 and API config is read and validated in `config/env.ts` |
| `f1v-no-token-in-web-storage` | ERROR | Tokens stay in memory; Auth0 is configured with refresh tokens for exactly that reason |
| `f1v-no-dangerously-set-inner-html` | ERROR | Everything rendered comes from OpenF1 by way of the API |
| `f1v-no-target-blank-without-noopener` | WARNING | `window.opener` handles back into this origin |
| `f1v-project-level-data-role` | ERROR | SEC-3, checked in source — Conftest checks the same rule against a plan, which needs credentials a fork PR does not have |
| `f1v-floating-latest-image` | ERROR | REL-1: dev and prod share a registry, so a bare `:latest` is whichever build pushed last |

All eleven currently report **zero findings** against this tree. They are
regression guards, not a backlog.

## Rules are tested

Each `*.yaml` has a sibling test fixture with `// ruleid:` and `// ok:`
annotations marking the lines that must and must not match:

```bash
semgrep --test --metrics=off .semgrep
```

CI runs this before it runs the rules, so a rule that has stopped matching what
it claims to match fails on its own terms rather than by quietly finding nothing.

## Adding a rule

1. Write it under the language directory, with a `message` that says what to do
   instead and why — the message is the whole interface for whoever hits it.
2. Add a fixture with at least one `ruleid` case and one `ok` case. The `ok` case
   is the one that matters: it is what stops the rule firing on correct code.
3. Run `semgrep --test --metrics=off .semgrep`.
4. Run it against the tree: `semgrep scan --config=.semgrep --metrics=off .` and
   confirm the finding count is what you expect, ideally zero.

Prefer a structural pattern to `pattern-regex`. A regex matches raw file text,
including comments — `f1v-bigquery-hardcoded-dataset` was written that way first
and reported ten Javadoc comments that describe the rule itself.
