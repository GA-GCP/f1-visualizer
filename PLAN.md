# Implementation Plan: Cloud Run Resource Parameterization + Folder Renaming

---

## Part 1: Full Repository Analysis Summary

### Architecture Overview

F1 Visualizer is an enterprise-grade monorepo containing:

- **Backend** — 4 Spring Boot microservices (Java 25) in a Maven multi-module project with 10 shared commons libraries. Services: `data-ingestion` (Reactive/WebFlux), `telemetry` (WebSocket/STOMP), `data-analysis` (REST/MVC), `user` (REST/MVC).
- **Frontend** — React 19 SPA with TypeScript, Vite, D3.js, Canvas API, Material UI, STOMP WebSocket client.
- **Infrastructure** — 11 reusable OpenTofu modules composed via Terragrunt with GCS remote state. Modules cover Cloud Run, IAM, networking, BigQuery, Redis, Firestore, API Gateway, load balancers, Artifact Registry, and CloudBuild triggers.
- **CI/CD** — Dual-layer: GitHub Actions for PR validation on `main`, Cloud Build for 7 path-filtered deployment pipelines on environment branches (`dev`/`uat`/`prod`).

### Current Cloud Run Module State

The `infrastructure/modules/cloud-run/main.tf` currently **hardcodes** container resource limits:

```hcl
resources {
  limits = {
    cpu    = "1000m"    # Hardcoded: 1 vCPU
    memory = "512Mi"    # Hardcoded: 512 MiB
  }
}
```

All 5 Cloud Run services (frontend + 4 backend) use the same 1 vCPU / 512Mi allocation regardless of their actual resource needs. The `container_concurrency` variable is defined but never wired into the resource.

---

## Part 2: CPU/Memory Resource Analysis & Recommendations

### Service: `f1v-service-data-ingestion`

**Why it's bottlenecking at 1 vCPU / 512Mi:**

| Operation | Resource Impact |
|-----------|----------------|
| **Replay Engine** — Loads up to 50,000 telemetry + 50,000 location packets into in-memory `ArrayList`s for simulation replay | **~150-200 MB** RAM just for replay buffers |
| **Batch BigQuery Inserts** — Flushes 500-row batches via `InsertAllRequest` with blocking `.query()` calls | CPU spikes during JSON serialization of batch payloads |
| **Historical Data Loaders** — 5 loader classes fetch from OpenF1 REST API using `.collectList().block()`, holding entire response lists in memory | Memory pressure from holding 50K+ objects |
| **MQTT Live Stream** — Persistent WebSocket connection with per-message Jackson JSON parsing + Redis publish | Steady-state CPU for JSON parse/serialize per message |
| **Scheduled Tick** — `@Scheduled(fixedRate = 250)` iterates replay lists 4 times/second | CPU contention when replay is active alongside batch loads |
| **JVM Overhead** — Java 25 on Spring Boot 4.0 with WebFlux + multiple GCP clients (BigQuery, Redis, Secret Manager) | Base JVM footprint ~200-250 MB |

**Estimated Memory Breakdown:**
- JVM base + Spring Boot + GCP clients: ~250 MB
- Replay buffers (100K objects): ~150 MB
- BigQuery batch staging: ~10-20 MB
- API response buffering: ~50 MB
- **Total peak: ~450-500 MB** → exceeds 512Mi limit

**Recommendation:**
```
cpu    = "2000m"   (2 vCPUs)
memory = "1024Mi"  (1 GiB)
```

**Rationale:** The service is both CPU-intensive (concurrent JSON parsing, BigQuery batch serialization, 4Hz replay ticks) and memory-intensive (50K+ object replay buffers, blocking API responses held in memory). 2 vCPUs allow the WebFlux event loop, scheduled tick, and batch operations to run without CPU starvation. 1 GiB gives comfortable headroom above the ~500 MB peak.

---

### Service: `f1v-service-telemetry`

**Why it's bottlenecking at 1 vCPU / 512Mi:**

| Operation | Resource Impact |
|-----------|----------------|
| **Redis Pub/Sub Listener** — Subscribes to 3 channels (`live_telemetry`, `live_location`, `playback_status`) with single-threaded message callbacks | CPU for message deserialization at high message rates |
| **WebSocket Broadcasting** — `SimpMessagingTemplate.convertAndSend()` to all connected STOMP clients per Redis message | CPU for per-client frame serialization; memory for WebSocket session buffers |
| **Connection State** — Maintains persistent WebSocket connections for all connected browsers | Memory per connection (~2-5 KB per session) |
| **Spring WebSocket Infrastructure** — STOMP broker relay, SockJS fallback, channel interceptor for JWT auth | Base memory overhead for WebSocket subsystem |

This service is architecturally a pass-through (Redis → WebSocket) with no data transformation, but high-frequency message rates during live telemetry (20-50 Hz per driver × 20 drivers = 400-1000 messages/sec) create CPU pressure, and maintaining many concurrent WebSocket connections creates memory pressure.

**Estimated Memory Breakdown:**
- JVM base + Spring Boot + WebSocket subsystem: ~200 MB
- Redis listener threads + buffers: ~30 MB
- WebSocket session state (50 concurrent users): ~50-100 MB
- Message serialization buffers: ~20 MB
- **Total peak: ~300-400 MB** → approaches 512Mi limit under load

**Recommendation:**
```
cpu    = "2000m"   (2 vCPUs)
memory = "1024Mi"  (1 GiB)
```

**Rationale:** The `min_instance_count = 1` config already acknowledges this service is latency-sensitive. During live sessions, high message rates (potentially 1000+ messages/sec broadcast to all WebSocket clients) demand CPU for frame serialization. 2 vCPUs ensure the Redis listener thread and WebSocket broadcast threads aren't competing. 1 GiB handles WebSocket session state scaling. Note: the Terragrunt config already sets `container_concurrency = 1000` (vs default 80), confirming this service is expected to handle many concurrent connections — it needs the resources to match.

---

### Other Services (no changes needed):

| Service | Current (1 vCPU / 512Mi) | Assessment |
|---------|--------------------------|------------|
| `f1v-service-data-analysis` | Adequate | Simple REST → BigQuery queries. BigQuery does the heavy lifting server-side. Low memory, low CPU. |
| `f1v-service-user` | Adequate | Simple REST → Firestore CRUD. Minimal resource usage. |
| `f1v-webapp` | Adequate | Static nginx serving a React SPA. Negligible resource needs. |

---

## Part 3: Implementation Steps

### Step 1 — Add `cpu` and `memory` variables to the cloud-run module

**File:** `infrastructure/modules/cloud-run/variables.tf`

Add two new variables with sensible defaults that maintain backward compatibility:

```hcl
variable "cpu" {
  description = "CPU limit for the Cloud Run container (e.g., '1000m' = 1 vCPU, '2000m' = 2 vCPUs)"
  type        = string
  default     = "1000m"
}

variable "memory" {
  description = "Memory limit for the Cloud Run container (e.g., '512Mi', '1024Mi', '2Gi')"
  type        = string
  default     = "512Mi"
}
```

### Step 2 — Wire variables into the resource block

**File:** `infrastructure/modules/cloud-run/main.tf`

Replace the hardcoded values:

```hcl
# Before:
resources {
  limits = {
    cpu    = "1000m"
    memory = "512Mi"
  }
}

# After:
resources {
  limits = {
    cpu    = var.cpu
    memory = var.memory
  }
}
```

### Step 3 — Set resource values in Terragrunt environment instances

**File:** `infrastructure/environments/dev/f1v-service-data-ingestion/terragrunt.hcl`

Add to the `inputs` block:

```hcl
cpu    = "2000m"
memory = "1024Mi"
```

**File:** `infrastructure/environments/dev/f1v-service-telemetry/terragrunt.hcl`

Add to the `inputs` block:

```hcl
cpu    = "2000m"
memory = "1024Mi"
```

The other 3 services (`data-analysis`, `user`, `f1v-webapp`) do not specify `cpu`/`memory`, so they inherit the module defaults of `1000m` / `512Mi` — no changes needed.

### Step 4 — Rename physical directories (modules)

Rename the following directories using `git mv`:

```
infrastructure/modules/artifact_registry  →  infrastructure/modules/artifact-registry
infrastructure/modules/iam_and_secrets    →  infrastructure/modules/iam-and-secrets
```

### Step 5 — Rename physical directories (environment instances)

```
infrastructure/environments/dev/artifact_registry  →  infrastructure/environments/dev/artifact-registry
infrastructure/environments/dev/iam_and_secrets     →  infrastructure/environments/dev/iam-and-secrets
```

### Step 6 — Update Terragrunt `source` paths in renamed environment instances

**File:** `infrastructure/environments/dev/artifact-registry/terragrunt.hcl`

```hcl
# Before:
source = "../../../modules/artifact_registry"
# After:
source = "../../../modules/artifact-registry"
```

**File:** `infrastructure/environments/dev/iam-and-secrets/terragrunt.hcl`

```hcl
# Before:
source = "../../../modules/iam_and_secrets"
# After:
source = "../../../modules/iam-and-secrets"
```

### Step 7 — Update Terragrunt `dependency` paths referencing `iam_and_secrets`

Update `config_path` in all 4 service configs that depend on IAM:

**Files:**
- `infrastructure/environments/dev/f1v-service-data-analysis/terragrunt.hcl`
- `infrastructure/environments/dev/f1v-service-data-ingestion/terragrunt.hcl`
- `infrastructure/environments/dev/f1v-service-telemetry/terragrunt.hcl`
- `infrastructure/environments/dev/f1v-service-user/terragrunt.hcl`

```hcl
# Before:
config_path = "../iam_and_secrets"
# After:
config_path = "../iam-and-secrets"
```

### Step 8 — Update README.md references

Update all 6 occurrences of the old folder names in `README.md`:
- Line 267: `artifact_registry/` → `artifact-registry/`
- Line 269: `iam_and_secrets/` → `iam-and-secrets/`
- Line 398: `iam_and_secrets` → `iam-and-secrets`
- Line 402: `artifact_registry` → `artifact-registry`
- Line 422: `iam_and_secrets` → `iam-and-secrets`
- Line 426: `artifact_registry` → `artifact-registry`

### Impact Assessment — No CloudBuild / GitHub Actions Changes Needed

- **CloudBuild `infrastructure.yaml`**: Uses `infrastructure/modules/` (wildcard via tfsec) and `infrastructure/environments/${_ENV}` (Terragrunt run-all). Neither references specific module folder names — no changes needed.
- **CloudBuild triggers module** (`cloudbuild-triggers/main.tf`): Uses `infrastructure/**` glob pattern — no changes needed.
- **GitHub Actions `pr-checks.yml`**: Uses `infrastructure/modules/*/` wildcard — no changes needed.
- **Other CloudBuild pipelines** (backend-*.yaml, frontend.yaml, api-gateway.yaml): Do not reference infrastructure folder paths — no changes needed.

### Terragrunt Remote State Impact

Renaming directories **will change the Terragrunt state key paths** (since `path_relative_to_include()` is used in `root.hcl`). This means:
- The renamed modules will get **new** state file paths in GCS
- The old state files at the previous paths will be orphaned
- This is **safe for dev** since the actual GCP resources aren't being renamed — only the local folder paths change. Terragrunt will treat these as "new" modules and plan accordingly on next apply.
- If state continuity is desired, `tofu state mv` or manual GCS object renaming could be used — but for dev, a fresh `terragrunt run-all apply` is simplest.

---

## Summary of All Changes

| # | File/Directory | Change Type |
|---|---------------|-------------|
| 1 | `infrastructure/modules/cloud-run/variables.tf` | Add `cpu` and `memory` variables |
| 2 | `infrastructure/modules/cloud-run/main.tf` | Replace hardcoded limits with `var.cpu` / `var.memory` |
| 3 | `infrastructure/environments/dev/f1v-service-data-ingestion/terragrunt.hcl` | Add `cpu = "2000m"`, `memory = "1024Mi"`, update IAM dependency path |
| 4 | `infrastructure/environments/dev/f1v-service-telemetry/terragrunt.hcl` | Add `cpu = "2000m"`, `memory = "1024Mi"`, update IAM dependency path |
| 5 | `infrastructure/environments/dev/f1v-service-data-analysis/terragrunt.hcl` | Update IAM dependency path |
| 6 | `infrastructure/environments/dev/f1v-service-user/terragrunt.hcl` | Update IAM dependency path |
| 7 | `infrastructure/modules/artifact_registry/` | Rename directory → `artifact-registry/` |
| 8 | `infrastructure/modules/iam_and_secrets/` | Rename directory → `iam-and-secrets/` |
| 9 | `infrastructure/environments/dev/artifact_registry/` | Rename directory → `artifact-registry/` |
| 10 | `infrastructure/environments/dev/iam_and_secrets/` | Rename directory → `iam-and-secrets/` |
| 11 | `infrastructure/environments/dev/artifact-registry/terragrunt.hcl` | Update module `source` path |
| 12 | `infrastructure/environments/dev/iam-and-secrets/terragrunt.hcl` | Update module `source` path |
| 13 | `README.md` | Update 6 folder name references |
