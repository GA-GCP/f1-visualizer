# F1 Visualizer

> *An enterprise-grade, cloud-native Formula 1 telemetry and historical data visualization platform.*

---

## Overview

F1 Visualizer is a comprehensive full-stack monorepo that implements an event-driven cloud architecture purpose-built for real-time motorsport data. Designed to replicate an authentic Race Engineer console, the platform ingests live telemetry from the OpenF1 API via MQTT, brokers it through Redis Pub/Sub, and broadcasts it to connected clients over STOMP WebSockets — all while serving a historical data warehouse powered by BigQuery for deep analytical queries.

The project enforces enterprise-grade practices throughout: Zero-Trust security with OAuth2/JWT at every boundary, principle-of-least-privilege IAM with dedicated per-service identities, fully modular Infrastructure as Code with environment promotion, path-filtered CI/CD pipelines with security scanning at every stage, and Spring Boot layered Docker images on minimal distroless base images.

---

## Highlights

- **Live Race Console** — Connects to active F1 session data via STOMP WebSockets, rendering a dynamic, low-latency circuit trace on the HTML5 Canvas API at 60fps. Telemetry packets (speed, RPM, gear, throttle, brake, DRS) stream through a Redis Pub/Sub broker and display in real-time data panels with team-color-coded driver indicators.

- **Historical Data Vault** — Query and replay any past Grand Prix session through a searchable session catalog backed by BigQuery. A persistent media controller (play/pause/seek) drives a replay engine that re-broadcasts historical telemetry at original timing intervals, while D3.js line charts visualize lap time progressions across all drivers.

- **Head-to-Head Comparison** — A split-screen analytical dashboard using D3.js radar charts (speed, consistency, aggression, tire management, experience) and animated Framer Motion stat bars (wins, podiums) to compare driver performance profiles side-by-side.

- **Race Engineer Aesthetic** — A dark-mode glassmorphism UI built with Material UI and the Titillium Web typeface (the official F1 broadcast font family), using real team hex colors, driver numbers, and a radial gradient canvas that evokes an authentic pit wall data console.

---

## Architecture

### High-Level System Architecture

```
                                    +---------------------------+
                                    |       Auth0 (IdP)         |
                                    |   OAuth2 / OIDC / JWKS    |
                                    +------------+--------------+
                                                 |
                                          JWT Validation
                                                 |
    +------------------+                +--------v---------+                +-------------------+
    |                  |   HTTPS/WSS    |                  |   HTTPS        |                   |
    |   React SPA      +--------------->+  Global HTTPS    +<------------->+   Google Cloud     |
    |   (Cloud Run)    |                |  Load Balancer   |               |   API Gateway      |
    |                  |                |                  |               |   (OpenAPI 2.0)    |
    +------------------+                +----+--------+----+               +----+----------+----+
                                             |        |                        |          |
                                        /ws  |        | /*                     |          |
                                             |        |            +-----------+          |
                              +--------------+        +----------->+                      |
                              |                                    |   Path-Based         |
                              v                                    |   Routing            |
                  +-----------+-----------+                        |                      |
                  |                       |              +---------v---+  +-----------+  +v-----------+
                  |  Telemetry Service    |              |  Analysis   |  | Ingestion |  |   User     |
                  |  (WebSocket/STOMP)    |              |  Service    |  | Service   |  |  Service   |
                  |                       |              |  (REST)     |  | (Reactive)|  |  (REST)    |
                  +-----------+-----------+              +------+------+  +-----+-----+  +-----+------+
                              |                                |               |               |
                              |  subscribe                     |               |               |
                              v                                v               |               v
                  +-----------+-----------+          +---------+--------+      |       +-------+------+
                  |                       |          |                  |      |       |              |
                  |    Redis Memorystore  |          |     BigQuery     |      |       |   Firestore  |
                  |    (Pub/Sub Broker)   |          |  (Data Warehouse)|      |       | (User Store) |
                  |                       |          |                  |      |       |              |
                  +-----------+-----------+          +------------------+      |       +--------------+
                              ^                                               |
                              |  publish                                      |
                              |                                               |
                  +-----------+-----------+                                   |
                  |                       |              +--------------------v---+
                  |  Ingestion Service    |              |                        |
                  |  (Redis Publisher)    |              |  OpenF1 API (External) |
                  |                       |              |  REST + MQTT Streams   |
                  +-----------+-----------+              +------------------------+
                              ^
                              |
                  +-----------+-----------+
                  |                       |
                  |  OpenF1 MQTT Broker   |
                  |  (wss:// Live Feed)   |
                  |                       |
                  +------------------------+
```

### Real-Time Data Flow

The real-time pipeline is the core of the platform — a four-hop event-driven chain that moves telemetry data from the track to the browser in near real-time:

```
+-------------------+     +-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |     |                   |
|  OpenF1 MQTT      | --> |  Ingestion        | --> |  Redis            | --> |  Telemetry        |
|  Broker           |     |  Service          |     |  Memorystore      |     |  Service          |
|                   |     |                   |     |                   |     |                   |
|  Live car data    |     |  MQTT listener    |     |  3 Pub/Sub        |     |  Redis subscriber |
|  Location coords  |     |  JSON parsing     |     |  channels:        |     |  STOMP broadcast  |
|  Session events   |     |  Redis publish    |     |  - live_telemetry |     |  to /topic/*      |
|                   |     |                   |     |  - live_location  |     |                   |
+-------------------+     +-------------------+     |  - playback_status|     +--------+----------+
                                                    +-------------------+              |
                                                                                       | WebSocket
                                                                                       v
                                                                              +--------+----------+
                                                                              |                   |
                                                                              |  React SPA        |
                                                                              |                   |
                                                                              |  useTelemetry()   |
                                                                              |  useLocation()    |
                                                                              |  60fps buffer     |
                                                                              |  Canvas render    |
                                                                              +-------------------+
```

1. **OpenF1 MQTT** — The Ingestion Service maintains a persistent MQTT connection (Eclipse Paho) to the OpenF1 live data stream, subscribing to car telemetry and location topics per active session.
2. **Ingestion Service** — Parses incoming MQTT JSON payloads into typed DTOs and publishes them to Redis Pub/Sub channels. In simulation mode, a Replay Engine replays historical data at original timing intervals with play/pause/seek control.
3. **Redis Memorystore** — Acts as a decoupled message broker between the Ingestion and Telemetry services. Three channels carry telemetry packets, GPS coordinates, and playback state respectively.
4. **Telemetry Service** — A Redis subscriber that re-broadcasts every received message to connected STOMP WebSocket clients. The frontend subscribes to `/topic/race-data`, `/topic/race-location`, and `/topic/playback-status`.
5. **React SPA** — Custom hooks (`useTelemetry`, `useLocation`) buffer incoming packets via `useRef` and flush to the render layer at 60fps using `requestAnimationFrame`, preventing React re-render storms while maintaining smooth Canvas and D3 animations.

### Historical Data Flow

```
+-------------------+     +-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |     |                   |
|  OpenF1 REST API  | --> |  Ingestion        | --> |  BigQuery         | --> |  Analysis         |
|                   |     |  Service          |     |  Data Warehouse   |     |  Service          |
|  /sessions        |     |                   |     |                   |     |                   |
|  /laps            |     |  Batch loaders:   |     |  Tables:          |     |  SQL queries      |
|  /car_data        |     |  - Sessions       |     |  - sessions       |     |  Lap times, stats |
|  /location        |     |  - Laps           |     |  - laps           |     |  Driver profiles  |
|  /position        |     |  - Locations      |     |  - telemetry (P)  |     |  Reference data   |
|  /stints          |     |  - Results        |     |  - locations (P)  |     |                   |
|                   |     |  - Reference data |     |  - drivers        |     +--------+----------+
+-------------------+     +-------------------+     |  - results        |              |
                                                    |                   |              | REST API
                                                    | (P) = Partitioned |              v
                                                    |  by DAY, clustered|     +--------+----------+
                                                    |  by session +     |     |                   |
                                                    |  driver           |     |  React SPA        |
                                                    +-------------------+     |                   |
                                                                              |  D3.js charts     |
                                                                              |  Session search   |
                                                                              |  Lap comparisons  |
                                                                              +-------------------+
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19 | Component-based UI framework |
| | TypeScript | 5.9 | Static type safety across the codebase |
| | Vite | 7.3 | Build tooling with HMR and environment modes |
| | D3.js | 7 | SVG-based data visualizations (line charts, radar charts) |
| | HTML5 Canvas | — | High-performance 60fps circuit trace rendering |
| | Material UI | 7.3 | Component library with dark-mode glassmorphism theme |
| | Framer Motion | 12 | Physics-based animation for stat comparison bars |
| | @stomp/stompjs | 7.3 | STOMP protocol client over SockJS WebSocket transport |
| | Axios | 1.13 | HTTP client with JWT interceptor |
| | Auth0 React SDK | 2.15 | OAuth2/OIDC authentication flow |
| **Backend** | Java | 25 | Language runtime (Temurin distribution) |
| | Spring Boot | 4.0 | Microservice framework |
| | Spring Security | 7.x | OAuth2 Resource Server with JWT validation |
| | Spring WebSocket | — | STOMP message broker with SockJS fallback |
| | Spring WebFlux | — | Reactive non-blocking HTTP for the Ingestion Service |
| | Eclipse Paho | — | MQTT 3.1.1 client for OpenF1 live data stream |
| | Jackson 3 | — | JSON serialization with automatic module discovery |
| | Lombok | — | Boilerplate reduction (@Builder, @Data) |
| **Data** | BigQuery | — | Columnar data warehouse with DAY-partitioned, clustered tables |
| | Firestore | Native | Document database for user profiles and preferences |
| | Redis (Memorystore) | 6.x | In-memory Pub/Sub broker between microservices |
| **Cloud** | Cloud Run | v2 | Serverless container platform with VPC connector support |
| | API Gateway | — | OpenAPI 2.0 request routing with OAuth2 JWT enforcement |
| | Secret Manager | — | Secure credential storage for external API keys |
| | Cloud Load Balancing | Global | HTTPS termination with managed SSL and path-based routing |
| | VPC + Connector | — | Private networking for Cloud Run to Redis communication |
| | Artifact Registry | — | Docker image repository with layer caching |
| **IaC** | OpenTofu | 1.9 | Infrastructure as Code (Terraform-compatible, open-source) |
| | Terragrunt | 0.77 | DRY configuration wrapper with dependency orchestration |
| **CI/CD** | Cloud Build | — | 7 path-filtered pipelines (build, scan, deploy) |
| | GitHub Actions | — | PR quality gates (lint, test, validate) |
| | Kaniko | — | Rootless, layer-cached Docker image builds |
| | Trivy | — | Container filesystem vulnerability scanning |
| | tfsec | — | Infrastructure-as-Code static security analysis |
| **Container** | Distroless | Java 25 | Minimal backend runtime (no shell, no package manager) |
| | nginx-unprivileged | Alpine | Lightweight frontend serving with SPA routing |

---

## Repository Structure

```
f1-visualizer/
|
+-- frontend/                          # React 19 Single Page Application
|   +-- src/
|   |   +-- api/                       # Axios HTTP client + STOMP WebSocket client
|   |   |   +-- apiClient.ts           #   Environment-aware Axios instance with JWT interceptor
|   |   |   +-- referenceApi.ts        #   Drivers, sessions, stats endpoints
|   |   |   +-- ingestionApi.ts        #   Live/simulation commands and playback control
|   |   |   +-- userApi.ts             #   User profile and preferences
|   |   |   +-- stompClient.ts         #   STOMP-over-SockJS with JWT authentication
|   |   +-- auth/                      # Auth0 integration
|   |   |   +-- AuthHandler.tsx        #   Axios request interceptor (Bearer token injection)
|   |   |   +-- StompAuthHandler.tsx   #   WebSocket STOMP CONNECT authentication
|   |   +-- components/                # React components
|   |   |   +-- RaceSimulator.tsx      #   Main live console: telemetry panels + circuit trace
|   |   |   +-- CircuitTrace.tsx       #   HTML5 Canvas real-time track visualization
|   |   |   +-- LapTimeChart.tsx       #   D3.js SVG multi-driver lap time line chart
|   |   |   +-- MediaController.tsx    #   Play/pause/seek for simulation replay
|   |   |   +-- ErrorBoundary.tsx      #   Auto-retry error boundary (3 attempts, 2s delay)
|   |   |   +-- layout/               #   App shell, navigation, user settings modal
|   |   |   +-- selectors/            #   Reusable driver and session autocomplete selectors
|   |   |   +-- versus/               #   Radar chart and animated stat comparison bars
|   |   +-- context/                   # React Context
|   |   |   +-- UserContext.tsx        #   Global user profile + preferences state
|   |   +-- hooks/                     # Custom React hooks
|   |   |   +-- useTelemetry.ts       #   STOMP subscription with 60fps buffered flush
|   |   |   +-- useLocation.ts        #   STOMP subscription preserving all GPS points
|   |   +-- pages/                     # Route-level page components
|   |   |   +-- Home.tsx              #   Live Console (RaceSimulator)
|   |   |   +-- HistoricalData.tsx    #   Data Vault (session search + lap charts)
|   |   |   +-- VersusMode.tsx        #   Head-to-Head (radar + stat bars)
|   |   +-- types/                     # TypeScript interfaces
|   |   +-- App.tsx                    # Auth0 provider, theme, routing
|   |   +-- main.tsx                   # Vite entry point
|   +-- nginx.conf                     # SPA-aware nginx config for production
|   +-- Dockerfile                     # Multi-stage local build (Node -> nginx)
|   +-- Dockerfile.ci                  # Lean CI image (pre-built dist -> nginx)
|   +-- vite.config.ts                 # Dev server proxy to 4 backend services + WebSocket
|   +-- vitest.config.ts               # jsdom test environment with setup
|   +-- eslint.config.js               # TypeScript-ESLint + React Hooks rules
|
+-- backend/                           # Maven Multi-Module Spring Boot Microservices
|   +-- pom.xml                        # Aggregator POM (Java 25)
|   +-- Dockerfile                     # Multi-stage local build (Maven -> distroless)
|   +-- Dockerfile.ci                  # Lean CI image (pre-extracted layers -> distroless)
|   |
|   +-- f1v-commons-parent/            # Spring Boot 4.0.3 parent POM
|   +-- f1v-commons-bom/               # Bill of Materials (10 shared libraries)
|   |   +-- f1v-commons-base/          #   Lombok, base model annotations
|   |   +-- f1v-commons-security/      #   OAuth2 JWT resource server, CORS policy, STOMP auth
|   |   +-- f1v-commons-service-base/  #   WebMvc, Actuator, Jackson 3, Secret Manager client
|   |   +-- f1v-commons-service-rest/  #   REST service foundation (extends service-base)
|   |   +-- f1v-commons-service-reactive/  # WebFlux foundation (extends service-base)
|   |   +-- f1v-commons-service-websocket/ # STOMP + MQTT dependencies
|   |   +-- f1v-commons-gcp-bq/        #   BigQuery client configuration
|   |   +-- f1v-commons-gcp-firestore/ #   Firestore client configuration
|   |   +-- f1v-commons-gcp-memorystore-redis/  # Redis template + Pub/Sub listener config
|   |   +-- f1v-commons-api-openf1/    #   OpenF1 REST + MQTT client, auth token management
|   |
|   +-- f1v-service-data-analysis/     # REST: BigQuery queries for laps, stats, reference data
|   +-- f1v-service-data-ingestion/    # Reactive: OpenF1 ingest, batch loaders, replay engine
|   +-- f1v-service-telemetry/         # WebSocket: Redis listener -> STOMP broadcaster
|   +-- f1v-service-user/              # REST: Firestore user profiles and preferences
|
+-- infrastructure/                    # OpenTofu + Terragrunt IaC
|   +-- root.hcl                       # Terragrunt root config (GCS state backend)
|   +-- modules/                       # 11 reusable OpenTofu modules
|   |   +-- cloud-run/                 #   Serverless container services
|   |   +-- api-gateway/               #   OpenAPI-driven request routing
|   |   +-- bigquery/                  #   Dataset + 6 tables with partitioning/clustering
|   |   +-- firestore/                 #   Document database with delete protection
|   |   +-- redis/                     #   Memorystore instance (HA in production)
|   |   +-- artifact-registry/         #   Docker image repository
|   |   +-- networking/                #   VPC, subnets, firewall rules, VPC connector
|   |   +-- iam-and-secrets/           #   6 service accounts with scoped IAM bindings
|   |   +-- lb-api/                    #   Global HTTPS LB with WebSocket path bypass
|   |   +-- lb-frontend/              #   Global HTTPS LB for React SPA
|   |   +-- cloudbuild-triggers/       #   7 path-filtered CI/CD triggers
|   +-- environments/
|   |   +-- dev/                       # Dev environment Terragrunt configurations
|   |       +-- (16 module instances with dependency declarations)
|   +-- openapi.yaml                   # API Gateway OpenAPI 2.0 specification
|
+-- cloudbuild/                        # GCP Cloud Build Pipeline Definitions
|   +-- backend-data-analysis.yaml     # Build, scan, deploy: Analysis Service
|   +-- backend-data-ingestion.yaml    # Build, scan, deploy: Ingestion Service
|   +-- backend-telemetry.yaml         # Build, scan, deploy: Telemetry Service
|   +-- backend-user.yaml              # Build, scan, deploy: User Service
|   +-- frontend.yaml                  # Lint, test, build, deploy: React SPA
|   +-- api-gateway.yaml               # Discover URLs, inject, validate, deploy, smoke test
|   +-- infrastructure.yaml            # tfsec scan, Terragrunt init/plan/apply
|
+-- .github/
    +-- workflows/
        +-- pr-checks.yml              # 3 parallel PR jobs: backend, frontend, infrastructure
```

---

## Backend Architecture

### Microservice Decomposition

The backend is composed of four independently deployable Spring Boot microservices, each with a single clearly-defined responsibility:

| Service | Type | Responsibility | GCP Dependencies |
|---------|------|---------------|-----------------|
| **data-ingestion** | WebFlux (Reactive) | Ingest live telemetry via MQTT, batch-load historical sessions from OpenF1 REST API, drive the replay engine | BigQuery, Redis, Secret Manager |
| **telemetry** | WebSocket/STOMP | Subscribe to Redis channels and broadcast to all connected WebSocket clients | Redis |
| **data-analysis** | Spring MVC (REST) | Serve lap times, driver statistics, session catalog, and reference data from BigQuery | BigQuery |
| **user** | Spring MVC (REST) | Manage user profiles and preferences with get-or-create semantics on first login | Firestore |

### Commons Bill of Materials

All microservices compose their dependencies from a shared BOM of 10 internal libraries. This ensures consistent versions, shared security configuration, and zero duplication of infrastructure concerns:

```
f1v-commons-bom
|
+-- f1v-commons-base                   Lombok, base annotations
+-- f1v-commons-security               OAuth2 JWT, CORS, STOMP auth interceptor
+-- f1v-commons-service-base           WebMvc, Actuator, Jackson 3, Secret Manager
+-- f1v-commons-service-rest           REST service foundation
+-- f1v-commons-service-reactive       WebFlux reactive foundation
+-- f1v-commons-service-websocket      STOMP broker, MQTT client
+-- f1v-commons-gcp-bq                 BigQuery client bean
+-- f1v-commons-gcp-firestore          Firestore client bean
+-- f1v-commons-gcp-memorystore-redis  Redis template + Pub/Sub listener container
+-- f1v-commons-api-openf1             OpenF1 WebClient, auth token lifecycle
```

Each microservice picks only the modules it needs — for example, `f1v-service-telemetry` pulls in `commons-service-websocket` and `commons-gcp-memorystore-redis` but has no dependency on BigQuery or Firestore.

### Key Backend Patterns

- **Scoped Maven Builds** — Each CI pipeline compiles only the target module and its transitive commons dependencies (`mvn -pl <module> -am`), avoiding a full monorepo rebuild on every change.
- **Spring Boot Layered JARs** — Production images use `java -Djarmode=layertools -jar ... extract` to split the fat JAR into four Docker layers (dependencies, loader, snapshots, application), maximizing cache reuse since dependency layers rarely change.
- **Stateless JWT Validation** — All services validate JWTs locally using the Auth0 JWKS endpoint. No session state exists anywhere in the backend — every request carries its own authentication context.
- **STOMP Channel Interceptor** — WebSocket connections are authenticated at the STOMP protocol level. The interceptor extracts the JWT from the CONNECT frame's Authorization header, validates it, and sets the security principal before any message routing occurs.
- **Scheduled Token Refresh** — The OpenF1 API client automatically refreshes its access token on a fixed schedule via `@Scheduled`, maintaining an always-valid credential without request-time auth overhead.
- **Application Profiles** — Every service supports `local`, `dev`, `uat`, and `prod` profiles, with environment-specific configuration for database endpoints, Auth0 tenants, and Redis connectivity.

---

## Frontend Architecture

### Page Structure

| Route | Page | Key Components | Data Source |
|-------|------|---------------|-------------|
| `/` | Live Console | RaceSimulator, CircuitTrace (Canvas), MediaController | STOMP WebSocket |
| `/historical` | Data Vault | Session search (Autocomplete), LapTimeChart (D3.js SVG) | REST API + BigQuery |
| `/versus` | Head-to-Head | DriverSelector (x2), RadarChart (D3.js SVG), StatComparisonBar (Framer Motion) | REST API + BigQuery |

### Real-Time Rendering Pipeline

The live console uses a carefully designed rendering pipeline to handle high-frequency WebSocket data without overwhelming React's reconciliation:

```
STOMP Message Received
        |
        v
useRef Buffer (accumulate)          <-- No React re-render
        |
        v
requestAnimationFrame (60fps)       <-- Browser vsync
        |
        v
Flush buffer -> setState            <-- Single batched re-render
        |
        v
Canvas 2D draw / D3.js update       <-- Visual update
```

The `useTelemetry` hook flushes only the latest packet (UI displays current values), while `useLocation` flushes all buffered packets (Canvas needs every GPS coordinate to draw continuous trace paths).

### Visualization Details

- **CircuitTrace** — A `<canvas>` element using `CanvasRenderingContext2D` with D3 linear scales to map world coordinates (x, y, z) to screen space. The selected driver's trace renders in their team color with a shadow glow effect; all other drivers render as ghosted semi-transparent paths. A `ResizeObserver` maintains a 1.6:1 aspect ratio on window resize.

- **LapTimeChart** — An SVG line chart built with `d3.line()`, `d3.scaleLinear()`, and `d3.axisBottom/Left`. Each driver gets a colored series line. An overlay captures mouse events to display a tooltip with exact lap time, sector splits, and tire compound at the hovered lap.

- **RadarChart** — A five-axis spider chart comparing driver attributes on a 0–100 scale. Concentric grid rings provide reference points. Each driver's polygon is filled with their team color at reduced opacity.

### Security & Auth

Authentication flows through Auth0 with two parallel paths:

1. **HTTP Requests** — An Axios request interceptor (`AuthHandler`) calls `getAccessTokenSilently()` on every request and injects the `Authorization: Bearer` header. A response interceptor catches 401s for token expiration handling.

2. **WebSocket** — A dedicated `StompAuthHandler` activates the STOMP client with the JWT in the CONNECT frame headers. The backend's `StompAuthChannelInterceptor` validates this token before allowing subscription to any topic.

---

## Infrastructure as Code

### Module Architecture

The infrastructure is fully codified across 11 reusable OpenTofu modules, composed per environment via Terragrunt:

```
infrastructure/modules/
|
+-- iam-and-secrets      6 service accounts with principle-of-least-privilege bindings
|       |
+-- networking           VPC, subnet, firewall rules, serverless VPC connector
|       |
+-- artifact-registry    Docker image repository
+-- firestore            Document database (delete protection per env)
+-- bigquery             Dataset + 6 tables (partitioned + clustered)
+-- redis                Memorystore (BASIC for dev, STANDARD_HA for prod)
|       |
+-- cloud-run (x5)      Frontend + 4 backend services (VPC connector for Redis access)
|       |
+-- api-gateway          OpenAPI 2.0 routing with JWT enforcement
|       |
+-- lb-api               Global HTTPS LB with /ws WebSocket path bypass
+-- lb-frontend          Global HTTPS LB for React SPA
|       |
+-- cloudbuild-triggers  7 path-filtered CI/CD pipeline triggers
```

### Dependency Orchestration

Terragrunt manages the deployment order through explicit `dependency` blocks. The graph ensures that IAM identities and networking exist before any service that needs them:

```
iam-and-secrets ----+----> cloud-run (all services)
                    |
networking ---------+----> redis
                    |
artifact-registry --+
firestore ----------+
bigquery -----------+----> api-gateway -----> lb-api
                                              lb-frontend
                                              cloudbuild-triggers
```

### Key Infrastructure Patterns

- **Environment Promotion** — Module inputs are parameterized per environment (`dev`, `uat`, `prod`) via Terragrunt `inputs` blocks. Redis scales from BASIC to STANDARD_HA, Firestore enables delete protection, and Cloud Run adjusts min instances — all without changing module code.

- **GCS Remote State** — All Terraform state is stored in a GCS bucket with a hierarchical prefix structure (`env/module/terraform.tfstate`), enabling safe concurrent operations across modules.

- **WebSocket Load Balancer Bypass** — The API load balancer uses a URL map to route `/ws` and `/ws/*` directly to the Telemetry Service's Cloud Run instance via a serverless NEG, bypassing the API Gateway (which does not support WebSocket upgrades). All other paths route through the API Gateway for OpenAPI validation.

- **VPC Connector** — Cloud Run services that need Redis access (Ingestion and Telemetry) are configured with a VPC connector on a `/28` subnet, enabling private network communication without exposing Redis to the public internet.

- **Scoped IAM** — Each microservice runs under a dedicated service account with only the permissions it requires:
  - Analysis: BigQuery read + job execution
  - Ingestion: BigQuery write + Secret Manager read + Redis publish
  - Telemetry: Redis subscribe
  - User: Firestore read/write
  - Frontend: Zero permissions (completely isolated)

---

## Branching Strategy

The repository follows an **environment-promotion** branching model with `main` as the development trunk. Feature work integrates to `main` via pull requests, and changes promote sequentially through environment branches for deployment:

```
feature/*          main             dev              uat              prod
    |                |                |                |                |
    |   Pull Request |                |                |                |
    +--------------->|                |                |                |
    |    (PR Checks) |   Promotion PR |                |                |
    |                +--------------->|                |                |
    |                |   (CI gate)    |   Promotion PR |                |
    |                |                +--------------->|                |
    |                |                |   (CI gate)    |   Promotion PR |
    |                |                |                +--------------->|
    |                |                |                |   (CI gate +   |
    |                |                |                |    approval)   |
    |                |                |                |                |
    |   GitHub       |   Cloud Build  |   Cloud Build  |   Cloud Build  |
    |   Actions      |   (dev env)    |   (uat env)    |   (prod env)   |
    |   PR Checks    |   7 pipelines  |   7 pipelines  |   7 pipelines  |
```

### Branch Responsibilities

| Branch | Purpose | Deploys To | Trigger |
|--------|---------|-----------|---------|
| `main` | Development trunk — all feature branches merge here | Nothing (validation only) | GitHub Actions PR checks |
| `dev` | Development environment deployment | GCP Dev | Cloud Build on push (7 path-filtered pipelines) |
| `uat` | User acceptance testing deployment | GCP UAT | Cloud Build on push |
| `prod` | Production deployment | GCP Prod | Cloud Build on push (requires approval) |

### Promotion Flow

Each promotion is an explicit pull request from one environment branch to the next, creating a clear audit trail:

1. **feature → main** — Developer opens a PR. GitHub Actions runs backend tests, frontend lint + tests, and infrastructure validation. On merge, the code is integrated but not yet deployed.
2. **main → dev** — A promotion PR deploys to the dev environment. Cloud Build pipelines build, scan, containerize, and deploy all affected services.
3. **dev → uat** — After dev validation, a promotion PR moves the release candidate to the UAT environment for acceptance testing.
4. **uat → prod** — After UAT sign-off, a promotion PR deploys to production. This is the only promotion that will require explicit reviewer approval once branch protection rules are enabled.

---

## CI/CD Pipeline

### Dual-Layer Pipeline Strategy

The CI/CD system operates across two layers: **GitHub Actions** for fast PR validation on `main`, and **GCP Cloud Build** for environment deployment on promotion branches.

```
Pull Request to main                        Promotion to env branch (dev/uat/prod)
    |                                             |
    v                                             v
GitHub Actions (3 parallel jobs)            Cloud Build (7 path-filtered triggers)
    |                                             |
    +-- Backend: mvn clean package               +-- backend-data-analysis.yaml
    +-- Frontend: yarn lint + test               +-- backend-data-ingestion.yaml
    +-- Infra: tfsec + tofu validate             +-- backend-telemetry.yaml
                                                  +-- backend-user.yaml
                                                  +-- frontend.yaml
                                                  +-- api-gateway.yaml
                                                  +-- infrastructure.yaml
```

### PR Quality Gates (GitHub Actions)

Every pull request targeting `main` triggers three parallel validation jobs:

| Job | Steps | Purpose |
|-----|-------|---------|
| **Backend** | `mvn clean package -am` | Compile all modules + run full test suite |
| **Frontend** | `yarn lint` then `yarn test:ci` | ESLint checks + Vitest unit tests |
| **Infrastructure** | tfsec scan + `tofu validate` per module | Security analysis + HCL syntax validation |

### Environment Pipelines (Cloud Build)

Each Cloud Build pipeline is triggered only when files matching its path filter are pushed to an environment branch. The backend pipelines all follow the same five-step pattern:

```
1. Scoped Maven Build       mvn clean package -pl <module> -am
         |
2. Layer Extraction         java -Djarmode=layertools -jar ... extract
         |
3. Trivy Security Scan      trivy filesystem --severity CRITICAL,HIGH
         |
4. Kaniko Image Build       Layer-cached Docker build -> Artifact Registry
         |
5. Cloud Run Deploy         gcloud run services update --image=<sha-tagged>
```

### Key CI/CD Patterns

- **Path-Filtered Triggers** — Each trigger specifies `included_files` globs scoped to the relevant service directory plus its shared commons dependencies. A change to only the User Service will trigger only `backend-user.yaml` — not the other three backend pipelines. This eliminates redundant builds entirely.

- **Immutable Image Tags** — Every image is tagged with the git commit SHA (`${SHORT_SHA}`) in addition to `latest`. Cloud Run deployments reference the SHA tag, ensuring every deployment is traceable to an exact commit.

- **Lean CI Dockerfiles** — Separate `Dockerfile.ci` files accept pre-built artifacts (extracted JAR layers for backend, `dist/` for frontend) from earlier Cloud Build steps, eliminating the double-compilation that would occur with a standard multi-stage Dockerfile.

- **Layer-Cached Builds** — Kaniko's `--cache=true` with per-service `--cache-repo` repositories ensures that unchanged Docker layers are reused across builds, dramatically reducing build times for dependency-stable services.

- **Pre-Image Security Scanning** — Trivy scans the extracted JAR filesystem before the Docker image is built. This fails fast on vulnerabilities without wasting time building an image that would be rejected.

- **API Gateway Smoke Test** — After deploying a new API Gateway configuration, the pipeline waits for propagation and then hits the `/health` endpoint, failing the build if the gateway returns a server error.

---

## Security Architecture

Security is enforced at every layer of the stack:

| Layer | Mechanism | Detail |
|-------|----------|--------|
| **Identity** | Auth0 (OAuth2/OIDC) | All user authentication via Auth0 with PKCE flow |
| **API Authentication** | JWT (RS256) | Every HTTP request validated against Auth0 JWKS endpoint |
| **WebSocket Authentication** | STOMP Interceptor | JWT validated on CONNECT frame before topic subscription |
| **API Gateway** | OpenAPI Security Scheme | JWT audience and issuer enforcement at the gateway edge |
| **Network Isolation** | VPC + Private Access | Redis accessible only via VPC connector (no public IP) |
| **IAM** | Per-Service Accounts | 6 dedicated identities with principle-of-least-privilege |
| **Secrets** | Secret Manager | External API credentials stored in Secret Manager, never in code |
| **Container Hardening** | Distroless Images | No shell, no package manager — minimal attack surface |
| **IaC Scanning** | tfsec | Static analysis of all OpenTofu modules on every PR |
| **Image Scanning** | Trivy | Filesystem vulnerability scan on every backend build |
| **Session Policy** | Stateless | No server-side sessions; CSRF disabled (JWT-only auth) |
| **CORS** | Origin Allowlist | Strict origin validation with credential support |

---

## Quick Start (Local Development)

### Prerequisites

- **JDK 25** (Temurin recommended)
- **Maven 3.9+**
- **Node.js 22+** with **Yarn**
- **GCP credentials** configured via `gcloud auth application-default login` (for BigQuery/Firestore access)

### Backend

```bash
cd backend
mvn clean install
```

Each service can be started individually. The Vite dev server proxies API calls to:
- Telemetry: `localhost:8080`
- Ingestion: `localhost:8081`
- Analysis: `localhost:8082`
- User: `localhost:8083`

### Frontend

```bash
cd frontend
yarn install
yarn dev
```

Opens at `http://localhost:5173` with Hot Module Replacement.

---

## Disclaimer

*F1 Visualizer is an unofficial, open-source personal project and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.*
