# F1V Backend Architecture Review

An end-to-end read of the four microservices and ten commons modules under `backend/`, with the infrastructure and pipelines they depend on, graded for security, reliability, performance and complexity, and turned into a ranked plan.

| | |
|---|---|
| **Reviewed** | 2026-09-08 |
| **Commit** | `1c55a59` on `main` |
| **Scope** | `backend/` plus the Terraform, Cloud Build and gateway config that shapes it |
| **Method** | Full source read, Maven dependency analysis, verified test run |

Finding IDs: **S** security, **R** reliability, **P** performance, **C** complexity, **T** testing, **O** operations. Severity: **High** act this sprint, **Medium** schedule, **Low** hygiene. Effort: **S** under a day, **M** a few days, **L** a sprint or more. Java paths in the findings omit the shared `src/main/java/com/elysianarts/f1/visualizer/…` prefix.

---

## Verdict

**Modern stack, sound security perimeter, and a replay engine that the platform is quietly working against.**

The backend is small (3,679 lines of main code across 57 classes) and current: Spring Boot 4.1.1, Java 25, Jackson 3, Spring Security 7 with issuer-and-audience JWT validation on every service, distroless layered images, per-service GCP identities. The test suite is green (182 tests, 29 classes, 23.8 s) and the controller slices actually exercise the security filter chain. That is a stronger base than most projects of this size.

Three things hold it back. **Authorization stops at "has a token"**: any Auth0 user can delete and reload BigQuery reference tables, start ingestion jobs that cost money, and control the replay every other viewer is watching. **The stateful parts run on a stateless platform**: the replay engine and MQTT bridge live in one JVM's memory while Cloud Run is free to run five ingestion instances and throttles their CPU between requests. **The build is heavier than the code**: 17 POMs, five commons modules with no code, two parent chains, and version pins that already produce a mixed JUnit runtime.

None of this needs a rewrite. The ranked list below is ordered by risk reduced per day of effort; the first seven items are each a day or less.

| Figure | Meaning |
|---|---|
| **182** | tests, all passing in 23.8 s (re-run for this review) |
| **17** | Maven modules for 3,679 lines of main code |
| **5 / 10** | commons modules that contain no code |
| **170** | compile-scope jars in data-ingestion (WebFlux and WebMvc both present) |
| **~150** | Redis round trips per 250 ms replay tick at 20 cars |
| **0** | authorization rules beyond `authenticated()` |

### What is already strong, and should be kept

- Stateless OAuth2 resource servers on every service, with the issuer and audience validated from Boot properties; CSRF correctly off for bearer-token APIs.
- STOMP CONNECT frames are authenticated with the same `JwtDecoder`, so the WebSocket path is not an anonymous side door.
- Per-service service accounts with narrow roles; the frontend identity has no bindings at all.
- Layered Spring Boot jars on distroless with Trivy in the deploy path; path-filtered Cloud Build triggers.
- The windowed replay engine (60 s chunks, prefetch at 50 %) replaced a whole-session-in-memory design and is well covered (20 tests).
- BigQuery tables are day-partitioned and clustered on `session_key, driver_number`, which matches the replay queries exactly.
- `ReferenceDataService` uses named query parameters; the frontend deliberately never retries POSTs.
- `@WebMvcTest` slices import the real security config and assert 401s, rather than disabling security in tests.

---

## Top actions (ranked)

Ordered by risk removed per unit of effort.

| # | Action | Why now | Effort | Findings |
|---|---|---|---|---|
| 1 | Pin the ingestion service to one always-on instance: `max_instance_count = 1`, `cpu_idle = false` | Replay commands can already land on the wrong instance, and the tick loop runs CPU-throttled between requests. | S | R1 |
| 2 | Gate `/ingestion/load-*` and `/ingestion/command` behind an Auth0 permission | Every signed-in user can delete and rewrite BigQuery reference tables today. | S–M | S1 |
| 3 | Turn on Memorystore AUTH and in-transit TLS, Redis 7 | Anything on the VPC can publish forged telemetry to every browser. | S | S2 |
| 4 | Re-subscribe on MQTT reconnect and reconnect with a fresh token | After the first dropped connection the live feed goes silent without an error. | S | R2 |
| 5 | Batch packets per tick into one Redis message and one STOMP frame per channel | Roughly 100× fewer Redis commands and WebSocket frames; the frontend already coalesces per animation frame. | S–M | P1 |
| 6 | Outbound timeouts, a second scheduler thread, fail-closed WebSocket auth | Three one-line fixes that each remove a way to hang a request thread or lose authentication silently. | S | R6, R7, S4 |
| 7 | Shared RFC 9457 `ProblemDetail` advice; stop echoing exception messages | 5xx bodies currently leak GCP client messages; the three services return three error shapes. | S | S5 |
| 8 | Precompute driver stats after each load; Caffeine in front of the Firestore reference cache | The stats query full-scans the telemetry table per request; the "cache" is a full remote collection read per request. | M | P2, P3 |
| 9 | Remove `allUsers` from the REST services; restrict telemetry ingress to the load balancer | Gateway quotas and edge CORS are bypassable via the `*.run.app` URLs. | M | S3 |
| 10 | Make historical loads asynchronous jobs and idempotent (Storage Write API or MERGE) | Loads exceed the 120 s gateway deadline and duplicate rows when re-run. | M | R3, R4 |
| 11 | One parent POM, drop redundant pins, add enforcer, Maven wrapper, Dependabot for Maven and Docker | JUnit API and engine already differ; backend dependencies are never bumped automatically. | M | C2, O1, S8 |
| 12 | Collapse ten commons modules to four; replace WebFlux with `RestClient` and virtual threads | Removes a runtime stack, five empty modules and the fluent-chain test mocks in one move. | L | C1, C3, P4 |

---

## Architecture as found

Seventeen modules, four deployables, one shared dataset. Line counts are main code only. Jar counts are compile-scope artifacts from `mvn dependency:tree`.

### Commons modules

10 modules · 657 lines · parent: `f1v-commons-bom` (which is also the imported BOM)

| Module | Contents | Main lines | Jars |
|---|---|---|---|
| `f1v-commons-base` | Lombok only. **POM only** | 0 | – |
| `f1v-commons-security` | Security filter chain, CORS source | 54 | 34 |
| `f1v-commons-service-base` | Two Jackson configs; drags in Web, Actuator, Secret Manager, spring-tx | 40 | 91 |
| `f1v-commons-service-rest` | webmvc + validation starters. **POM only** | 0 | 99 |
| `f1v-commons-service-reactive` | webflux starter. **POM only** | 0 | 118 |
| `f1v-commons-service-websocket` | STOMP broker config, JWT CONNECT interceptor, Paho MQTT dependency | 98 | 63 |
| `f1v-commons-gcp-bq` | BigQuery client bean | 14 | 89 |
| `f1v-commons-gcp-firestore` | Firestore client dependency (config lives in the services). **POM only** | 0 | 65 |
| `f1v-commons-gcp-memorystore-redis` | Redis starter (config lives in the services). **POM only** | 0 | 46 |
| `f1v-commons-api-openf1` | OpenF1 WebClient, auth token service, DTOs, Secret Manager fetch | 451 | 101 |

### Services

4 Cloud Run services · 3,022 lines · parent: `f1v-commons-parent`

| Service | Role | Main lines | Jars | Cloud Run size |
|---|---|---|---|---|
| `f1v-service-data-ingestion` | OpenF1 REST and MQTT ingest, BigQuery loaders, replay engine publishing to Redis | 1,565 | 170 | 2 vCPU / 1 Gi |
| `f1v-service-data-analysis` | Lap, stats and reference endpoints over BigQuery with a Firestore cache | 1,082 | 156 | 1 vCPU / 512 Mi |
| `f1v-service-telemetry` | Redis subscriber re-broadcasting to STOMP topics | 114 | 129 | 2 vCPU / 1 Gi |
| `f1v-service-user` | Profile get-or-create and preferences in Firestore | 261 | 117 | 1 vCPU / 512 Mi |

### The real-time path, per 250 ms replay tick

Counts assume a 20-car session at OpenF1's published rates (car data about 4 Hz, location about 3.7 Hz per car). This is the path P1 and R1 change.

```
BigQuery chunk            ~150 packets                 Redis pub/sub               ~150 × N frames              Browser
60 s window in memory,    each a blocking              3 channels:                 one STOMP frame per          buffers in a ref,
prefetched at 50 %        convertAndSend, plus one     live_telemetry,             packet per connected         flushes once per
ReplayEngine.tick()   →   progress message         →   live_location,          →   client                   →   animation frame
                          RedisTemplate · VPC          playback_status             SimpleBroker · /topic/*      useTelemetry /
                          connector                    no AUTH, no TLS (S2)                                     useLocation
```

---

## Findings

### Security

#### S1 · High · Every authenticated user is an administrator

- **Where:** `commons-security · F1VisualizerSecurityConfig.java`, `data-ingestion · controller/v1/IngestionController.java`, `infrastructure/openapi.yaml`
- **Found:** The only authorization rule in the codebase is `anyRequest().authenticated()`; there is no `hasAuthority`, `@PreAuthorize` or scope check anywhere. With a valid token, `POST /api/v1/ingestion/load-reference` deletes and rewrites the `sessions`, `drivers` and `session_drivers` tables; `/load-historical` runs minutes of OpenF1 calls and billable streaming inserts; `/command` switches the global mode and opens an MQTT connection; play, pause and seek change what every other viewer sees. Anyone who can sign up to the Auth0 tenant can do all of it, and the gateway spec enforces no scopes either.
- **Do:** Define API permissions in Auth0 (for example `ingest:admin`, `playback:control`) with RBAC enabled so they land in the access token, map them with a `JwtAuthenticationConverter`, and add `.requestMatchers("/api/v1/ingestion/load-*", "/api/v1/ingestion/command").hasAuthority("ingest:admin")` ahead of the catch-all. Keep playback open to users only if that is the product intent, and rate-limit it. Mirror the scopes in the gateway's security definition so rejected calls stop at the edge.
- **Effort:** S–M

#### S2 · High · Redis is reachable without a password or TLS

- **Where:** `infrastructure/modules/redis/main.tf`, `infrastructure/modules/networking/main.tf`, `*/application-{dev,uat,prod}.yml`
- **Found:** The Memorystore instance sets neither `auth_enabled` nor `transit_encryption_mode`, the services connect with host and port only, and the VPC firewall allows all internal TCP. Anything that reaches the connector subnets can publish forged packets to every browser or read the feed. The instance also runs `REDIS_6_X` where 7.x is available.
- **Do:** `auth_enabled = true`, `transit_encryption_mode = "SERVER_AUTHENTICATION"`, `redis_version = "REDIS_7_X"`; deliver the AUTH string from Secret Manager into `SPRING_DATA_REDIS_PASSWORD` via Cloud Run `--set-secrets`; set `spring.data.redis.ssl.enabled=true`; narrow the firewall to the connector ranges on port 6379.
- **Effort:** S

#### S3 · High · All four services are public, so the gateway and load balancer are optional

- **Where:** `infrastructure/modules/cloud-run-backend/main.tf`, `infrastructure/environments/*/f1v-service-*/terragrunt.hcl`, `infrastructure/openapi.yaml` (`disable_auth: true`)
- **Found:** Every service has `ingress = INGRESS_TRAFFIC_ALL` and an `allUsers` invoker binding, so the `*.run.app` URLs answer straight from the internet. In-app JWT validation still holds, which is why this is not critical, but the gateway's quotas, the LB's edge CORS handling and any future Cloud Armor policy can be walked around. `disable_auth: true` on every gateway backend is what forces the public binding.
- **Do:** REST services: remove `allUsers`, give the gateway a service account with `roles/run.invoker` on each service, and set `disable_auth: false` plus `jwt_audience` in the OpenAPI backends. Telemetry: `ingress = INGRESS_TRAFFIC_INTERNAL_AND_GCLB` (it is fronted by the LB's serverless NEG) with the public invoker kept. Keep validating JWTs in the services as defense in depth.
- **Effort:** M

#### S4 · Medium · WebSocket authentication fails open

- **Where:** `commons-service-websocket · WebSocketConfig.java`, `commons-service-websocket · StompAuthChannelInterceptor.java`
- **Found:** `JwtDecoder` is injected with `required = false` and the interceptor is only registered when it is present. If the resource-server auto-configuration ever does not produce a decoder (a missing issuer property, a starter change, a test profile) the broker silently accepts every CONNECT. Only CONNECT is inspected; SUBSCRIBE and SEND carry no authorization rules, and `/ws/**` is `permitAll` at the HTTP layer, so this interceptor is the single gate.
- **Do:** Make the decoder a required constructor dependency. Add `@EnableWebSocketSecurity` with `simpDestMatchers("/topic/**").authenticated()` and deny everything else. Reject with `AccessDeniedException` rather than `IllegalArgumentException`. Add a slice test asserting the interceptor is on the inbound channel.
- **Effort:** S

#### S5 · Medium · Error responses leak internals and differ per service

- **Where:** `user · exception/GlobalExceptionHandler.java`, `data-analysis` (no advice), `data-ingestion` (plain-text bodies)
- **Found:** The user service returns `"Internal server error: " + ex.getMessage()`, which echoes GCP client messages, table names and project ids to the browser. Analysis has no handler and falls back to Boot's default error JSON; ingestion returns free-text strings. Clients cannot handle errors uniformly and support cannot correlate them.
- **Do:** One `@RestControllerAdvice` in commons returning RFC 9457 `ProblemDetail` (`spring.mvc.problemdetails.enabled=true`), generic messages for 5xx, a correlation id in both the body and the log line.
- **Effort:** S

#### S6 · Medium · Credential handling in the OpenF1 client

- **Where:** `commons-api-openf1 · config/SecretManagerConfig.java`, `commons-api-openf1 · service/OpenF1AuthService.java`, `commons-api-openf1 · client/OpenF1Client.java`
- **Found:** The project id defaults to a hardcoded `f1-visualizer-488201`; secrets are read at version `latest` with a hand-rolled Secret Manager client that brings the client, protobuf and gRPC stack into every ingestion image; the bearer token is a non-volatile `String` read from HTTP, scheduler and MQTT threads; when authentication has failed, requests still go out with the literal header `Bearer null` and the resulting 401 is swallowed as "no data" (see R5).
- **Do:** Mount the two secrets as environment variables with Cloud Run `--set-secrets` (versions pinned in Terraform) and drop the Secret Manager dependency; hold the token in an `AtomicReference`; refresh from `expires_in`; throw when no token is available instead of sending the request.
- **Effort:** S

#### S7 · Low · CORS origins live in four places, and localhost ships to production

- **Where:** `commons-security · F1VisualizerSecurityConfig.java`, `commons-service-websocket · WebSocketConfig.java`, `infrastructure/modules/lb-api/main.tf`, `infrastructure/openapi.yaml` (≈40 OPTIONS blocks)
- **Found:** The origin list is hardcoded in Spring, in the STOMP endpoint, in the LB URL map and in the gateway, including `http://localhost:5173` in production images. The LB now answers preflight at the edge, so the gateway's OPTIONS routes are dead weight that still has to be kept in sync.
- **Do:** An `f1v.cors.allowed-origins` property per environment feeding both Spring and the STOMP endpoint; delete the OPTIONS routes from the gateway spec.
- **Effort:** S

#### S8 · Low · Supply-chain gaps around the backend build

- **Where:** `.github/dependabot.yml`, `backend/Dockerfile`, `backend/Dockerfile.ci`, `.github/workflows/pr-checks.yml`
- **Found:** Dependabot has no `maven` entry and no `docker` entry for `/backend`, so backend dependencies and base images are only ever bumped by hand (the history confirms it). Trivy runs only in the post-merge deploy pipeline, so a vulnerable dependency merges green. Base images use floating tags (`eclipse-temurin:25-jdk`, `gcr.io/distroless/java25-debian13`), the runtime container runs as root, and no SBOM is produced.
- **Do:** Add `maven` and `docker` ecosystems for `/backend`; pin images by digest and use the distroless `:nonroot` tag; run `trivy fs backend/` in the PR workflow; emit a CycloneDX SBOM (`cyclonedx-maven-plugin`) alongside `spring-boot:build-info`.
- **Effort:** S

### Reliability and correctness

#### R1 · High · Stateful singletons on an autoscaled, CPU-throttled platform

- **Where:** `data-ingestion · service/ReplayEngine.java`, `data-ingestion · service/IngestionWorker.java`, `data-ingestion · service/LiveStreamService.java`, `infrastructure/modules/cloud-run-backend/main.tf`, `infrastructure/environments/*/f1v-service-data-ingestion/terragrunt.hcl`
- **Found:** Replay position, mode and the MQTT connection live in one JVM's memory. The Terraform module leaves `max_instance_count` at its default of 5 for ingestion, so play, pause and seek land on whichever instance the gateway picks, and a scale-down discards the replay. The module also leaves `cpu_idle` at its default (CPU allocated only while a request is in flight), so the 250 ms tick loop, the prefetch executor and MQTT callbacks run throttled between HTTP calls. The same applies to the telemetry service's Redis subscriber whenever no WebSocket is open.
- **Do:** Now: `max_instance_count = 1` and `cpu_idle = false` for ingestion, and `cpu_idle = false` for telemetry. Next: move the replay engine and MQTT bridge into a dedicated always-on worker (min = max = 1, always-allocated CPU) that takes commands from a Redis stream, keep the HTTP loaders stateless and scalable, and hold playback state (mode, session, virtual clock) in Redis so any instance can answer status queries and a restarted worker can resume.
- **Effort:** S now, L later

#### R2 · High · MQTT reconnects lose their subscriptions and reuse an expired token

- **Where:** `data-ingestion · service/LiveStreamService.java`
- **Found:** `setAutomaticReconnect(true)` is combined with `setCleanSession(true)` and a plain `MqttCallback`. After a reconnect Paho does not restore subscriptions on a clean session; that requires `MqttCallbackExtended.connectComplete`, which is not implemented, so the live feed goes silent with no error. `connectionLost` refreshes the OpenF1 token, but the reconnect reuses the original connect options, so once the token expires reconnects fail until someone issues a new command. Each `connect()` builds a new client without closing the previous one, and `currentSessionKey` is written but never read. Paho MQTTv3 1.2.5 last shipped in 2020.
- **Do:** Implement `connectComplete` and re-subscribe there; on token refresh, disconnect and reconnect with fresh options; close the previous client in `connect()`; consider the HiveMQ client (maintained, MQTT 5, built-in reconnect with subscription replay). Export a reconnect counter and alert on it (O2).
- **Effort:** S–M

#### R3 · Medium · Minutes of work inside a single HTTP request

- **Where:** `data-ingestion · controller/v1/IngestionController.java`, `data-ingestion · service/HistoricalDataLoader.java`, `data-ingestion · service/LocationDataLoader.java`, `data-ingestion · F1VDataIngestionServiceApplication.java`
- **Found:** `POST /load-historical` runs four loaders inline; two of them sleep 500 ms per 15-minute window. A two-hour session is 8 windows × 2 loaders plus laps and results, well past the gateway's 120 s deadline and Cloud Run's 300 s default. The caller receives a 504 while the load continues, throttled (R1), with no way to observe it. `@EnableAsync` is declared but nothing is `@Async`.
- **Do:** Return `202 Accepted` with a job id; run loads on a bounded `TaskExecutor` (or Cloud Tasks into a worker); persist job status in Firestore and expose `GET /ingestion/jobs/{id}`; make loads idempotent (R4) so a retried request is harmless.
- **Effort:** M

#### R4 · Medium · Historical loads duplicate rows and rely on legacy streaming inserts

- **Where:** `data-ingestion · service/HistoricalDataLoader.java`, `data-ingestion · service/LocationDataLoader.java`, `data-ingestion · service/LapDataLoader.java`, `data-ingestion · service/ResultDataLoader.java`, `data-ingestion · service/ReferenceDataLoader.java`, `data-analysis · service/RaceAnalysisService.java`
- **Found:** The four session loaders call `insertAll` without an `insertId` and never clear existing rows, so re-running a load inserts everything again; the lap-times query has no dedup, so the chart doubles. Rows written through `insertAll` sit in the streaming buffer for up to about 90 minutes and cannot be removed by DML, so `ReferenceDataLoader`'s delete-then-insert can keep stale rows if run twice in a row. Streaming inserts also cost more than the Storage Write API.
- **Do:** Move to the BigQuery Storage Write API (exactly-once with stream offsets) or batch load jobs; land in a staging table and `MERGE` into the partitioned tables; at minimum set `insertId` to a deterministic hash of (session, driver, timestamp).
- **Effort:** M

#### R5 · Medium · Failures are turned into empty results

- **Where:** `commons-api-openf1 · client/OpenF1Client.java`, `data-ingestion · repository/Historical*Repository.java`, `data-analysis · service/RaceAnalysisService.java`, `data-analysis · service/ReferenceDataService.java`
- **Found:** `OpenF1Client` maps every error to an empty stream; the replay repositories return empty lists or `null` on any exception; `getDriverStats` returns placeholder 50/50/50 scores on failure, and the drivers list caches those placeholders in Firestore as if they were real. A 401 from OpenF1 reads as "no lap data"; a BigQuery outage reads as "simulation finished". Eighteen log calls drop the stack trace by logging only `e.getMessage()`.
- **Do:** Throw typed exceptions (`OpenF1Exception`, Spring's `DataAccessException`) and let the caller decide; retry transient 429 and 5xx with backoff (`retryWhen(Retry.backoff(3, Duration.ofMillis(500)))`, or Resilience4j once on `RestClient`); always log with the throwable.
- **Effort:** M

#### R6 · Medium · No timeouts on outbound calls

- **Where:** `commons-api-openf1 · config/WebClientConfig.java`, every `.block()` site, every `QueryJobConfiguration`
- **Found:** `WebClientConfig` replaces Boot's auto-configured `WebClient.Builder` with a bare one, so `spring.http.reactiveclient.*` timeouts and observation never apply, and Reactor Netty has no response timeout by default: a stalled OpenF1 connection blocks a request thread indefinitely. BigQuery jobs run with no `jobTimeoutMs` and no `maximumBytesBilled`.
- **Do:** Delete `WebClientConfig`; set `spring.http.reactiveclient.connect-timeout=5s` and `read-timeout=30s` (or `spring.http.client.*` after C3); set `setJobTimeoutMs` and `setMaximumBytesBilled` on every query.
- **Effort:** S

#### R7 · Medium · One scheduler thread shared by the replay tick and a blocking token refresh

- **Where:** `data-ingestion · service/IngestionWorker.java`, `commons-api-openf1 · service/OpenF1AuthService.java`
- **Found:** Boot's default `TaskScheduler` has one thread. `OpenF1AuthService.refreshToken()` is `@Scheduled` on it and blocks on an HTTP call, so a slow `/token` response freezes the 250 ms replay tick for its duration. The same method runs in `@PostConstruct` on the main thread, delaying startup and readiness on every deploy, and refreshes on a fixed 50 minutes regardless of `expires_in`.
- **Do:** `spring.task.scheduling.pool.size=2` or a dedicated scheduler for the tick; first refresh from `ApplicationReadyEvent` off the main thread; schedule the next refresh from `expires_in`.
- **Effort:** S

#### R8 · Low · Cache warm-up rewrites Firestore on every instance start

- **Where:** `data-analysis · service/ReferenceDataService.java` (`warmCache`), `data-analysis · repository/ReferenceDataCacheRepository.java`
- **Found:** Every new instance (each deploy, each scale-out) starts a raw `new Thread` from `@PostConstruct`, re-queries BigQuery and rewrites every driver and session document; concurrent instances race; the thread is invisible to Spring's lifecycle and metrics; the single `WriteBatch` grows with the catalog.
- **Do:** Warm from an `ApplicationReadyEvent` listener on a managed executor; refresh only when a `meta/lastRefreshed` document is stale, or trigger the refresh from ingestion after `load-reference` (the only time the data changes); chunk batches.
- **Effort:** S

#### R9 · Low · Cancelling a prefetch does not cancel the query

- **Where:** `data-ingestion · service/ChunkLoader.java`, `data-ingestion · service/ReplayEngine.java` (`cancelPendingPrefetch`)
- **Found:** `CompletableFuture.cancel(true)` never interrupts the running BigQuery call, so after a seek the single-thread executor is still busy with the old chunk and the next prefetch queues behind it.
- **Do:** Track the BigQuery `Job` and cancel it, or give the executor two threads and discard stale results by chunk id.
- **Effort:** S

#### R10 · Low · No readiness, liveness or graceful shutdown

- **Where:** `infrastructure/modules/cloud-run-backend/main.tf`, `*/application.yml`
- **Found:** Cloud Run only learns a container is alive when the port opens; a service whose Redis or BigQuery client is broken keeps receiving traffic; on SIGTERM Tomcat drops WebSocket sessions and in-flight publishes immediately.
- **Do:** Enable Actuator probes (`management.endpoint.health.probes.enabled=true`), wire `startup_probe` and `liveness_probe` in Terraform, set `server.shutdown=graceful` with `spring.lifecycle.timeout-per-shutdown-phase=8s` to fit Cloud Run's 10 s grace period.
- **Effort:** S

### Performance and cost

#### P1 · High · One Redis command and one WebSocket frame per telemetry packet

- **Where:** `data-ingestion · service/ReplayEngine.java` (`tick`), `data-ingestion · service/LiveStreamService.java`, `telemetry · service/TelemetryListener.java`, `frontend/src/hooks/useTelemetry.ts`, `frontend/src/hooks/useLocation.ts`
- **Found:** Twenty cars at about 4 Hz car data and 3.7 Hz location is roughly 150 packets per 250 ms tick, each a blocking Redis round trip over the VPC connector, plus a progress message every tick. Telemetry re-broadcasts each packet as its own STOMP frame to every client, so 100 viewers means about 15,000 frames per tick out of one instance. The frontend already buffers in a ref and flushes once per animation frame, so per-packet delivery buys nothing.
- **Do:** Emit one message per channel per tick containing the packets as an array: one PUBLISH per channel per tick, one frame per client per tick, roughly 100× fewer operations end to end. Publish progress only when the integer changes. If per-packet messages must stay for some consumer, use `executePipelined` on the producer side.
- **Effort:** S–M

#### P2 · High · Driver stats full-scan the telemetry table on every request

- **Where:** `data-analysis · service/RaceAnalysisService.java` (`getDriverStats`), `infrastructure/modules/bigquery/main.tf`
- **Found:** The ten-CTE stats query includes `COUNTIF(throttle > 95)` over all of `telemetry` for the driver with no partition filter, so every `/drivers/{id}/stats` call scans the largest table end to end (seconds of latency, bytes billed growing with every ingested session) for numbers that only change when a session is loaded. The head-to-head page issues two per comparison and nothing caches the result.
- **Do:** Precompute a `driver_stats` table at the end of each ingestion run (or a scheduled query or materialized view) and serve it from Firestore or a Caffeine cache; set `require_partition_filter = true` on `telemetry` and `locations` so an unfiltered scan cannot be written by accident; set `maximumBytesBilled` as a guardrail.
- **Effort:** M

#### P3 · Medium · The reference-data "cache" is a full remote collection read per request

- **Where:** `data-analysis · service/ReferenceDataService.java`, `data-analysis · repository/ReferenceDataCacheRepository.java`
- **Found:** `getAvailableSessions`, `searchSessions`, `getAvailableYears`, `getSessionsByYear` and `getMasterDriverList` each read every `reference_sessions` or `reference_drivers` document from Firestore and then filter in memory; search runs per keystroke from the frontend. The README's "in memory" description is not what runs.
- **Do:** Spring Cache with Caffeine (`@Cacheable("sessions")`, TTL 15–60 min) in front of Firestore; evict when `load-reference` completes (publish an invalidation on Redis); add `Cache-Control` and ETag headers on these endpoints.
- **Effort:** S

#### P4 · Medium · The JVM runs on defaults, and virtual threads are switched off for a fully blocking codebase

- **Where:** `backend/Dockerfile.ci` (ENTRYPOINT), `infrastructure/modules/cloud-run-backend/variables.tf` (512Mi default), `*/application.yml`
- **Found:** The entrypoint passes no JVM options, so the default heap cap is 25 % of container memory (about 128 MB on the 512 Mi user and analysis instances) and an OOM leaves a wedged instance instead of a restart. Every I/O path is blocking (BigQuery, Firestore, MQTT, every `.block()`), which is precisely what Java 25 virtual threads serve, yet `spring.threads.virtual.enabled` is off. Nothing uses CDS or AOT, so every deploy pays full JIT warm-up despite `startup_cpu_boost`.
- **Do:** `JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"`; `spring.threads.virtual.enabled=true`; build a CDS archive in the image (`spring-boot:process-aot` plus `-XX:AutoCreateSharedArchive`); size `container_concurrency` to what one vCPU handles rather than the 80 and 1000 defaults.
- **Effort:** S

#### P5 · Medium · Unbounded, uncompressed payloads with no HTTP caching

- **Where:** `data-analysis · controller/v1/AnalysisController.java`, `data-analysis · controller/v1/ReferenceDataController.java`, `*/application.yml`
- **Found:** About 1,200 lap rows per race and the full session catalog go out uncompressed on every call (`server.compression.enabled` is unset); reference data that changes once a season carries no `Cache-Control` or ETag.
- **Do:** `server.compression.enabled=true` (and at the LB); `Cache-Control: public, max-age=3600` on reference endpoints; `ShallowEtagHeaderFilter`; a `year` filter on `/sessions`.
- **Effort:** S

#### P6 · Low · Dead full-session queries and seek latency

- **Where:** `data-ingestion · repository/HistoricalRepository.java` (`fetchSessionTelemetry`), `data-ingestion · repository/HistoricalLocationRepository.java` (`fetchSessionLocations`), `data-ingestion · service/ReplayEngine.java` (`seek`)
- **Found:** The two `LIMIT 200000` whole-session methods have no callers in main code; they are the memory-exhausting path the windowed engine replaced. `seek` runs a synchronous BigQuery query on the request thread while holding the engine lock, so every scrub costs one to three seconds and stalls the tick.
- **Do:** Delete the dead methods; keep a small LRU of recently played chunks so seeking back is instant; kick off the prefetch for the chunk after the seek target immediately.
- **Effort:** S

### Complexity and maintainability

#### C1 · High · Ten commons modules, five of them empty

- **Where:** `backend/f1v-commons-bom/*`, `commons-service-websocket/pom.xml` (three exclusions of service-base), `README.md` § Commons Bill of Materials
- **Found:** 657 lines of shared code are spread across ten modules; `base`, `gcp-firestore`, `gcp-memorystore-redis`, `service-reactive` and `service-rest` contain no Java. The Redis and Firestore configuration the README places in commons actually lives duplicated in the services. `mvn dependency:analyze` reports every service using 10–20 transitive artifacts it never declares while declaring commons modules it never references directly. `service-base` bundles Secret Manager and `spring-tx` (no transaction exists anywhere), so the websocket module has to exclude them to stay lean.
- **Do:** Collapse to four: `f1v-commons-web` (security, ProblemDetail advice, Jackson customizer, actuator), `f1v-commons-gcp` (BigQuery and Firestore beans, dataset properties), `f1v-commons-messaging` (Redis topics, serializer, STOMP config) and `f1v-commons-openf1` (client and DTOs). Move `RedisConfig` and `FirestoreConfig` out of the services.
- **Effort:** M

#### C2 · High · Parent, BOM and aggregator tangle with redundant version pins

- **Where:** `backend/pom.xml`, `backend/f1v-commons-parent/pom.xml`, `backend/f1v-commons-bom/pom.xml`
- **Found:** The root aggregator has no parent; services inherit `f1v-commons-parent`; commons modules inherit `f1v-commons-bom`, which is simultaneously an aggregator, a parent and an imported BOM. The BOM re-declares Boot starters with `${spring-boot.version}` and pins `spring-tx` 7.0.9, `spring-data-commons` 4.1.1, `junit-jupiter-api` 6.1.3, `jackson-bom` 3.2.2 (Boot 4.1.1 manages 3.1.5) and `google-cloud-firestore` 3.47.0 outside the GCP libraries BOM. Today that yields JUnit Jupiter API 6.1.3 running on engine and platform 6.1.2, and a Jackson two minor versions ahead of what Boot was verified against; the next Boot upgrade will quietly leave these pins behind. Lombok is declared in three places, and `springdoc-openapi-maven-plugin` is managed but never used.
- **Do:** One `f1v-parent` (Boot parent, plugin management, enforcer, shared test dependencies) as the parent of everything; delete every pin Boot or the GCP BOM already manages; keep a BOM only if the commons are ever published for external consumers; `${revision}` with `flatten-maven-plugin` for versioning; `maven-enforcer-plugin` with `requireJavaVersion`, `requireMavenVersion`, `dependencyConvergence` and `banDuplicatePomDependencyVersions`.
- **Effort:** M

#### C3 · Medium · Reactive in name only

- **Where:** `f1v-service-data-ingestion` (170 jars: spring-webflux and spring-webmvc both present), `commons-api-openf1 · client/OpenF1Client.java`, `data-ingestion · service/ReferenceDataLoader.java`, `commons-api-openf1 · test OpenF1AuthServiceTest.java`
- **Found:** The service runs on Tomcat and WebMvc; WebFlux exists only to provide `WebClient`, and every call is `.block()`ed. The reactive types add a runtime stack, an empty module and test complexity (a six-mock fluent chain plus reflection) without any non-blocking benefit.
- **Do:** Replace with Boot 4's `RestClient` and declarative `@HttpExchange` interfaces via `@ImportHttpServices`; timeouts through `spring.http.client.*`; retries through Resilience4j; pair with virtual threads (P4). Removes reactor-netty, webflux and the `service-reactive` module.
- **Effort:** M

#### C4 · Medium · Duplicated configuration and loaders, dead configuration

- **Where:** `data-ingestion` and `telemetry · config/RedisConfig.java`, `user` and `data-analysis · config/FirestoreConfig.java`, `data-ingestion · repository/Historical*Repository.java`, `data-ingestion · service/*Loader.java`, `*/application-*.yml` (`dataset-name`)
- **Found:** `RedisConfig` is near-identical in two services, including the topic names that are the producer/consumer contract; `FirestoreConfig` is identical in two services; the two replay repositories share query and mapping structure; four loaders repeat the same fetch → map → `insertAll` loop; `ReferenceDataLoader` re-implements the OpenF1 client with untyped `Map` instead of using `OpenF1Client`. `"f1_dataset"` is hardcoded in eight classes while `spring.cloud.gcp.bigquery.dataset-name` in every YAML is never read, and `https://api.openf1.org` appears in three classes.
- **Do:** A `@Validated @ConfigurationProperties("f1v")` record (dataset, OpenF1 base URLs, CORS origins, tick rate); a `RedisTopics` constants class and serializer factory in commons; a generic `BigQueryBatchWriter<T>`; every OpenF1 call through the typed client.
- **Effort:** M

#### C5 · Medium · Jackson configured against the framework

- **Where:** `commons-service-base · config/JacksonObjectMapperConfig.java`, `commons-service-base · config/Jackson3WebConfig.java`, `config/RedisConfig.java` (`USE_ANNOTATIONS` disabled), `commons-api-openf1 · dto/OpenF1CarData.java`
- **Found:** Boot 4 already auto-configures a Jackson 3 `JsonMapper` and the MVC converter; the custom `@Primary` bean bypasses `spring.jackson.*` properties and every `JsonMapperBuilderCustomizer`. The Redis mapper switches off all annotations to work around a single field (`@JsonProperty("n_gear")` on `gear`), and the contract test for the browser wire format lives in a different module from the two configs it protects. The history shows this interface breaking twice (#36, #43).
- **Do:** Delete both config classes (the existing `@WebMvcTest`s will confirm nothing changes). Annotate `gear` with `@JsonProperty("gear") @JsonAlias("n_gear")` so one standard mapper reads OpenF1 and writes the frontend shape, or introduce an explicit outbound `TelemetryFrame` record so the external DTO and the browser contract evolve independently, with the contract test next to the producer.
- **Effort:** S

#### C6 · Medium · Two sources of truth for environment configuration

- **Where:** `*/application-{dev,uat,prod}.yml`, `infrastructure/environments/*/f1v-service-*/terragrunt.hcl` (`env_vars`), `backend/.dockerignore`
- **Found:** Issuer, audience and Firestore ids exist both inside the jar and in Terraform ("NEW: Explicitly inject" comments). `.dockerignore` strips `application-dev.yml` and `-local.yml` from the local Docker build, so a locally built image behaves differently from the CI image unless the env vars are set, which is why the env vars were added. The user service's local profile uses `jwk-set-uri` (no issuer check) while everything else uses `issuer-uri`.
- **Do:** Twelve-factor: keep `application.yml` defaults plus `application-local.yml`; every environment value from IaC env vars and secrets; delete the profile YAMLs and the `.dockerignore` exclusions; validated `@ConfigurationProperties` so a missing value fails at startup rather than at first request.
- **Effort:** S

#### C7 · Low · Cruft

- **Where:** `data-ingestion · F1VDataIngestionServiceApplication.java`, `commons-gcp-bq/pom.xml`, `commons-service-base/pom.xml`, `commons-api-openf1 · client/OpenF1Client.java`
- **Found:** `excludeName` lists two Spring Cloud auto-configurations that are not on the classpath; a commented-out annotation sits above the real one; `@EnableAsync` has no `@Async`; the `spring-cloud-gcp-bigquery` starter is declared while `BigQueryConfig` builds the client by hand; `spring-tx` is a compile dependency with no transactions; `OpenF1Client` and `ReferenceDataLoader` carry test-only constructors marked `@Autowired`; injection style, logger style and 50 emoji-prefixed log lines vary by file.
- **Do:** Remove; standardize on constructor injection and `@Slf4j`; plain-text log messages with key=value context so they can be filtered and alerted on.
- **Effort:** S

#### C8 · Low · API contract inconsistencies

- **Where:** `data-analysis · model/DriverProfile.java`, `data-ingestion · controller/v1/IngestionController.java`, `data-ingestion · dto/request/IngestionCommandRequest.java`, `infrastructure/openapi.yaml`
- **Found:** The drivers list returns placeholder stats (50/50/50/30) that are then cached as data, while `/drivers/{id}/stats` computes real ones; ingestion returns free-text bodies and validates with manual null checks although the validation starter is on the classpath; `year` defaults to 2023; the 640-line gateway spec mirrors the controllers by hand and must be edited on every route change.
- **Do:** Drop `stats` from the list DTO or serve the real cached values; Bean Validation on request bodies; typed JSON responses everywhere; generate the gateway spec from springdoc (`springdoc-openapi-starter-webmvc-api`) and template only the backend addresses.
- **Effort:** S–M

### Testing

Re-run for this review: 182 tests in 29 classes, 0 failures, 23.8 s wall time on JDK 26 with `--release 25`.

#### T1 · Medium · All coverage is mock-based; the seams that have broken are untested

- **Where:** 21 of 29 classes are `MockitoExtension` units; `commons-api-openf1 · test OpenF1AuthServiceTest.java` (reflection into a private inner class); no Redis, Firestore, STOMP or end-to-end contract test
- **Found:** BigQuery is mocked at the `FieldValueList` level, the WebClient fluent chain is mocked six objects deep, and the private `AuthResponse` is built by reflection. The integration seams that broke in the git history (Redis wire format, STOMP auth, BigQuery timestamp handling) are exactly the ones no test exercises against a real component.
- **Do:** Testcontainers for Redis and the Firestore emulator with `@ServiceConnection`; one STOMP test with `WebSocketStompClient` proving CONNECT without a JWT is rejected and a Redis message reaches `/topic/race-data`; a contract test for the packet JSON shared by ingestion, telemetry and the frontend types; make `AuthResponse` a package-private record.
- **Effort:** M

#### T2 · Low · Two test classes are 53 % of the suite's wall time

- **Where:** `HistoricalDataLoaderTest` 7.1 s, `LocationDataLoaderTest` 5.6 s
- **Found:** The production `Thread.sleep(500)` per window runs for real inside the tests: 12.7 of 23.8 seconds.
- **Do:** Inject the delay as a `Duration` (zero in tests) or a `Sleeper` interface.
- **Effort:** S

#### T3 · Low · No backend quality gates in CI

- **Where:** `.github/workflows/pr-checks.yml` (backend job)
- **Found:** The backend job runs `mvn clean package -am`: `-am` is a no-op without `-pl`, `package` skips the `verify` phase where checks bind, and there is no coverage, static analysis or format gate, while the frontend enforces coverage thresholds, Prettier and a bundle budget. JDK 25 and 26 also print integrity warnings during tests (dynamic agent loading for Mockito, final-field mutation, Netty native access) that will become hard errors in a later JDK.
- **Do:** `mvn -B verify` with JaCoCo `check` (start at today's coverage and ratchet), Spotless with google-java-format, ErrorProne or SpotBugs; ArchUnit rules for the commons layering; Surefire `argLine` with `-XX:+EnableDynamicAgentLoading --enable-final-field-mutation=ALL-UNNAMED --enable-native-access=ALL-UNNAMED`, or attach Mockito as a Java agent.
- **Effort:** S–M

### Build, delivery and operations

#### O1 · Medium · Build reproducibility

- **Where:** `backend/` (no `mvnw`), `backend/Dockerfile`, `cloudbuild/backend-*.yaml`
- **Found:** There is no Maven wrapper; the local Dockerfile installs whatever Maven Debian ships and copies the whole tree before resolving dependencies, so every local image build re-downloads everything; CI uses a pinned `maven:3.9.16` image; developers use whatever is on their machine. Base images are floating tags.
- **Do:** `mvn wrapper:wrapper -Dmaven=3.9.16`; a Dockerfile with a POM-only layer running `dependency:go-offline` and a BuildKit `--mount=type=cache,target=/root/.m2`; digest-pinned images; the enforcer rules from C2.
- **Effort:** S

#### O2 · Medium · No structured logs, traces or exported metrics

- **Where:** `*/application.yml`, `*/pom.xml` (no tracing or metrics registry)
- **Found:** Cloud Logging receives unstructured text, so severity and trace correlation are lost; there is no request trace from LB to gateway to service to BigQuery; Actuator metrics stay inside the container. Nothing measures replay lag, packets published per tick, MQTT reconnects or BigQuery bytes billed, so the failure modes in R2 and P2 are invisible until a user reports them.
- **Do:** `logging.structured.format.console=ecs`; Micrometer Tracing with the OTLP exporter into Cloud Trace (honouring `X-Cloud-Trace-Context` from the LB); metrics via OTLP or `spring-cloud-gcp-starter-metrics`; four custom metrics (replay lag, packets per tick, MQTT reconnects, BigQuery bytes processed); alerts on reconnect count and 5xx rate.
- **Effort:** M

#### O3 · Low · Release and pipeline hygiene

- **Where:** every `pom.xml` (`1.0.0-SNAPSHOT`), `cloudbuild/backend-*.yaml` (four copies differing in five lines), `infrastructure/environments/prod/*`
- **Found:** Nothing is ever versioned; the jar carries no build info, so a running instance cannot say which commit it is. Four Cloud Build pipelines are copies; each rebuilds the commons modules with `-am`, so one commons change costs four full builds. Terraform defaults the image to `:latest` and leaves `deletion_protection = false` in prod.
- **Do:** `${revision}` stamped by CI; `spring-boot:build-info` so `/actuator/info` reports the commit; one parameterized pipeline with `_MODULE` and `_IMAGE` substitutions; build commons once per commit or add a remote Maven build cache; `deletion_protection = true` in prod.
- **Effort:** S

---

## Roadmap

Three passes. The first is mostly configuration and one-file fixes; the second changes runtime behaviour; the third restructures. Each pass leaves the system deployable.

### Pass 1 · stop the bleeding (about a week, mostly one-line changes)

- **R1** Ingestion to one always-on instance
- **S2** Redis AUTH, TLS, Redis 7
- **R2** MQTT re-subscribe and fresh-token reconnect
- **R6, R7, S4** Timeouts, scheduler pool, fail-closed WebSocket
- **S5** Shared ProblemDetail advice
- **S8** Dependabot for Maven and Docker, Trivy on PRs
- **T2, C7, P6** Sleep injection, cruft and dead code removal

### Pass 2 · change the runtime (two to three sprints)

- **S1** Auth0 permissions on admin endpoints
- **P1** Batch packets per tick end to end
- **P2, P3** Precomputed stats, Caffeine, partition filters
- **S3** Private invokers and LB-only ingress
- **R3, R4** Async, idempotent loads on the Storage Write API
- **C5, C6** Standard Jackson, single configuration source
- **O2, R10** Structured logs, tracing, probes, graceful shutdown
- **P4, P5** JVM flags, virtual threads, compression and caching headers

### Pass 3 · restructure (a quarter, in parallel with feature work)

- **C2, O1** One parent, enforcer, wrapper, revision versioning
- **C1, C3** Four commons modules, RestClient instead of WebFlux
- **R1** Dedicated replay worker with state in Redis
- **T1** Testcontainers, STOMP and wire-contract tests
- **C4, C8** Typed configuration, generic batch writer, generated gateway spec
- **O3** One pipeline, build info, prod deletion protection

> **One thing to decide before Pass 3:** whether the replay engine is a product feature that must survive a scale event and a deploy, or a demo mode. If it is a feature, the dedicated worker in R1 is the design; if it is a demo, pinning one instance and batching per tick is enough and the module collapse can go first.

---

## Appendix

### Effective versions

| Component | Resolved | Note |
|---|---|---|
| Java | 25 (`--release 25`) | Temurin 25 in CI; JDK 26.0.2 on the review machine |
| Spring Boot | 4.1.1 | Parent of both chains |
| Spring Framework / Security / Data | 7.0.9 / 7.1.1 / 4.1.1 | Framework and Data pins match Boot today; redundant |
| Jackson 3 | 3.2.2 | Boot 4.1.1 manages 3.1.5; overridden via imported `jackson-bom` |
| JUnit Jupiter | API 6.1.3 · engine 6.1.2 | Mixed because `junit-jupiter-api` is pinned separately |
| Mockito / Lombok | 5.23.0 / 1.18.48 | Lombok pinned above Boot's 1.18.46 for JDK 25 support (fine) |
| Spring Cloud GCP / libraries BOM | 8.1.1 / 26.85.0 | Built for Boot 4.1.0; compatible |
| google-cloud-bigquery / firestore / secretmanager | 2.68.0 / 3.47.0 / 2.94.0 | Firestore pinned outside the libraries BOM |
| Lettuce / Netty / Reactor / Tomcat | 7.5.2 / 4.2.17 / 3.8.7 / 11.0.24 | Boot-managed |
| Eclipse Paho MQTT v3 | 1.2.5 | Last release 2020 |

### What `mvn dependency:analyze` said

| Module | Used but undeclared | Declared but unused |
|---|---|---|
| `f1v-service-data-ingestion` | 23 artifacts (spring-web, spring-data-redis, reactor-core, paho, bigquery, …) | 8, including all four commons modules it lists |
| `f1v-service-data-analysis` | 19 | 6 (service-rest, gcp-bq, gcp-firestore, three test starters) |
| `f1v-service-telemetry` | 10 | 8 (all four commons modules, four test starters) |
| `f1v-commons-api-openf1` | 16 | 2 (service-reactive, starter-test) |
| `f1v-commons-service-base` | 3 | 7 (starter-web, actuator, secretmanager, spring-tx, commons-base, …) |

"Declared but unused" for a starter is expected (starters are consumed by auto-configuration, not by code); the signal is the pattern: services depend on the commons modules for their transitive contents rather than for anything they contain, which is what C1 addresses.

### Test run

| Module | Tests | Slowest class |
|---|---|---|
| `f1v-commons-service-websocket` | 5 | StompAuthChannelInterceptorTest 0.44 s |
| `f1v-commons-api-openf1` | 17 | OpenF1AuthServiceTest 0.49 s |
| `f1v-service-data-analysis` | 52 | ReferenceDataControllerTest 0.97 s |
| `f1v-service-data-ingestion` | 82 | HistoricalDataLoaderTest 7.09 s, LocationDataLoaderTest 5.59 s |
| `f1v-service-telemetry` | 5 | TelemetryListenerTest 0.49 s |
| `f1v-service-user` | 21 | F1VUserControllerTest 0.96 s |
| **Total** | **182 · 0 failed · 0 skipped** | 23.8 s wall time |

### Method and limits

Every file under `backend/` outside `target/` was read in full (57 main classes, 29 test classes, 17 POMs, 24 YAML files, both Dockerfiles), together with the Terraform modules, Terragrunt environments, Cloud Build pipelines, gateway spec, GitHub workflow and the frontend's API and STOMP clients. `mvn dependency:tree`, `mvn dependency:analyze` and `mvn test` were run on the checked-out commit.

Not verified: the live Cloud Run settings (only the IaC was read, so a console-side override of CPU allocation or max instances would not be visible here), the Auth0 tenant configuration, and BigQuery table sizes and bytes billed. Findings that depend on those are phrased against what the repository would deploy.
