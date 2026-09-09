# F1 Visualizer

> *An enterprise-grade, cloud-native Formula 1 telemetry and historical data visualization platform.*

<p align="center">
  <!-- Frontend -->
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8.2" />
  <img src="https://img.shields.io/badge/D3.js-7-F9A03C?style=for-the-badge&logo=d3dotjs&logoColor=white" alt="D3.js" />
  <img src="https://img.shields.io/badge/MUI-9.4-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI" />
  <img src="https://img.shields.io/badge/Framer_Motion-13-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
  <br />
  <!-- Backend -->
  <img src="https://img.shields.io/badge/Java-25-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 25" />
  <img src="https://img.shields.io/badge/Spring_Boot-4.1-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 4.1" />
  <img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white" alt="Maven" />
  <img src="https://img.shields.io/badge/Auth0-EB5424?style=for-the-badge&logo=auth0&logoColor=white" alt="Auth0" />
  <br />
  <!-- Data -->
  <img src="https://img.shields.io/badge/BigQuery-669DF6?style=for-the-badge&logo=googlebigquery&logoColor=white" alt="BigQuery" />
  <img src="https://img.shields.io/badge/Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firestore" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <br />
  <!-- Cloud -->
  <img src="https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="Google Cloud" />
  <img src="https://img.shields.io/badge/Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="Cloud Run" />
  <br />
  <!-- IaC -->
  <img src="https://img.shields.io/badge/OpenTofu-1.12-FFDA18?style=for-the-badge&logo=opentofu&logoColor=black" alt="OpenTofu 1.12" />
  <img src="https://img.shields.io/badge/Terragrunt-1.1-E5F2FC?style=for-the-badge&logo=terraform&logoColor=5C4EE5" alt="Terragrunt 1.1" />
  <br />
  <!-- CI/CD & Containers -->
  <img src="https://img.shields.io/badge/Cloud_Build-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="Cloud Build" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Trivy-1904DA?style=for-the-badge&logo=aquasecurity&logoColor=white" alt="Trivy" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
  - [High-Level System Architecture](#high-level-system-architecture)
  - [Real-Time Data Flow](#real-time-data-flow)
  - [Historical Data Flow](#historical-data-flow)
- [Repository Structure](#repository-structure)
- [Backend Architecture](#backend-architecture)
  - [Microservice Decomposition](#microservice-decomposition)
  - [Commons Bill of Materials](#commons-bill-of-materials)
  - [Key Backend Patterns](#key-backend-patterns)
- [Frontend Architecture](#frontend-architecture)
  - [Page Structure](#page-structure)
  - [Real-Time Rendering Pipeline](#real-time-rendering-pipeline)
  - [Visualization Details](#visualization-details)
  - [Security & Auth](#security--auth)
  - [Frontend Resilience Patterns](#frontend-resilience-patterns)
  - [Design System](#design-system)
- [Infrastructure as Code](#infrastructure-as-code)
  - [Module Architecture](#module-architecture)
  - [Dependency Orchestration](#dependency-orchestration)
  - [Key Infrastructure Patterns](#key-infrastructure-patterns)
- [Branching Strategy](#branching-strategy)
- [CI/CD Pipeline](#cicd-pipeline)
  - [Dual-Layer Pipeline Strategy](#dual-layer-pipeline-strategy)
  - [PR Quality Gates (GitHub Actions)](#pr-quality-gates-github-actions)
  - [Environment Pipelines (Cloud Build)](#environment-pipelines-cloud-build)
  - [Key CI/CD Patterns](#key-cicd-patterns)
- [Testing](#testing)
- [Security Architecture](#security-architecture)
- [Environment Configuration](#environment-configuration)
- [Disclaimer](#disclaimer)

---

## Overview

F1 Visualizer is a comprehensive full-stack monorepo that implements an event-driven cloud architecture purpose-built for real-time motorsport data. Designed to replicate an authentic Race Engineer console, the platform ingests live telemetry from the OpenF1 API via MQTT, brokers it through Redis Pub/Sub, and broadcasts it to connected clients over STOMP WebSockets — all while serving a historical data warehouse powered by BigQuery for deep analytical queries.

The project enforces enterprise-grade practices throughout: Zero-Trust security with OAuth2/JWT at every boundary, principle-of-least-privilege IAM with dedicated per-service identities, fully modular Infrastructure as Code with environment promotion, path-filtered CI/CD pipelines with security scanning at every stage, and Spring Boot layered Docker images on minimal distroless base images.

---

## Highlights

- **Live Race Console** — Connects to active F1 session data via STOMP WebSockets, rendering a dynamic, low-latency circuit trace on the HTML5 Canvas API at 60fps. Telemetry packets (speed, RPM, gear, throttle, brake, DRS) stream through a Redis Pub/Sub broker and display in real-time data panels with team-color-coded driver indicators.

- **Historical Data Vault** — Query and replay any past Grand Prix session through a searchable session catalog backed by BigQuery. A persistent media controller (play/pause/seek) drives a replay engine that re-broadcasts historical telemetry at original timing intervals, while D3.js line charts visualize lap time progressions across all drivers.

- **Head-to-Head Comparison** — A split-screen analytical dashboard using D3.js radar charts (speed, consistency, aggression, tire management, experience) and animated Framer Motion stat bars (wins, podiums) to compare driver performance profiles side-by-side.

- **Race Engineer Aesthetic** — A dark-mode glassmorphism UI built with Material UI and the Titillium Web typeface (the official F1 broadcast font family), using real team hex colors, driver numbers, and a radial gradient canvas that evokes an authentic pit wall data console. A cinematic post-login splash sequence with Framer Motion letter-stagger reveals, layered gradient animations, and a circuit trace plays while reference data prefetches in the background.

---

## Quick Start (Local Development)

### Prerequisites

- **JDK 25** (Temurin recommended)
- **Maven 3.9+**
- **Node.js 26** with **Yarn** (classic, 1.x)
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
    +------------------+                +--------v---------+
    |                  |   HTTPS/WSS    |                  |
    |   React SPA      +--------------->+  Global HTTPS    |
    |   (Cloud Run,    |                |  Load Balancer   |
    |    Cloud CDN)    |                |  (Cloud Armor)   |
    +------------------+                +----+--------+----+
                                             |        |
                                        /ws  |        | /api/v1/{users,
                                             |        |  analysis,ingestion}
                              +--------------+        +----------+
                              |                                  |
                              v                                  v
                  +-----------+-----------+                        |                       |
                  |                       |              +---------v---+  +-----------+   +v-----------+
                  |  Telemetry Service    |              |  Analysis   |  | Ingestion |   |   User     |
                  |  (WebSocket/STOMP)    |              |  Service    |  | Service   |   |  Service   |
                  |                       |              |  (REST)     |  | (Reactive)|   |  (REST)    |
                  +-----------+-----------+              +------+------+  +-----+-----+   +-----+------+
                              |                                 |               |               |
                              |  subscribe                      |               |               |
                              v                                 v               |               v
                  +-----------+-----------+           +---------+--------+      |       +-------+------+
                  |                       |           |                  |      |       |              |
                  |    Redis Memorystore  |           |     BigQuery     |      |       |   Firestore  |
                  |    (Pub/Sub Broker)   |           |  (Data Warehouse)|      |       | (User Store) |
                  |                       |           |                  |      |       |              |
                  +-----------+-----------+           +------------------+      |       +--------------+
                              ^                                                 |
                              |  publish                                        |
                              |                                                 |
                  +-----------+-----------+                                     |
                  |                       |                +--------------------v---+
                  |  Ingestion Service    |                |                        |
                  |  (Redis Publisher)    |                |  OpenF1 API (External) |
                  |                       |                |  REST + MQTT Streams   |
                  +-----------+-----------+                +------------------------+
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
                                                    |  - session_drivers|              | REST API
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
| | TypeScript | 6.0 | Static type safety across the codebase |
| | Vite | 8.2 | Build tooling with HMR and environment modes |
| | D3.js | 7 | Canvas and SVG data visualizations (circuit trace, line charts, radar charts) |
| | HTML5 Canvas | — | High-performance 60fps circuit trace rendering |
| | Material UI | 9.4 | Component library with dark-mode glassmorphism theme |
| | Framer Motion | 13 | Page transitions, letter-stagger reveals, spring-physics nav indicators, stat bars |
| | @stomp/stompjs | 7.3 | STOMP protocol client over SockJS WebSocket transport |
| | Axios | 1.20 | HTTP client with JWT interceptor, retry logic, and 429 backoff |
| | Emotion | 11.14 | CSS-in-JS styling engine powering MUI's theme layer |
| | Auth0 React SDK | 2.24 | OAuth2/OIDC authentication flow with PKCE |
| **Backend** | Java | 25 | Language runtime (Temurin distribution) |
| | Spring Boot | 4.1 | Microservice framework |
| | Spring Security | 7.x | OAuth2 Resource Server with JWT validation |
| | Spring WebSocket | — | STOMP message broker with SockJS fallback |
| | Spring WebFlux | — | Reactive non-blocking HTTP for the Ingestion Service |
| | Spring Cloud GCP | 8.1.1 | GCP service integration (BigQuery, Firestore, Secret Manager) |
| | Eclipse Paho | 1.2.5 | MQTT 3.1.1 client for OpenF1 live data stream (QoS 1) |
| | Project Reactor | 3.8.7 | Reactive streams for non-blocking data ingestion pipeline |
| | Jackson 3 | 3.2.2 | JSON serialization with SNAKE_CASE convention |
| | Lombok | 1.18.48 | Boilerplate reduction (@Builder, @Data) |
| **Data** | BigQuery | — | Columnar data warehouse with DAY-partitioned, clustered tables |
| | Firestore | Native | Document database for user profiles and preferences |
| | Redis (Memorystore) | 6.x | In-memory Pub/Sub broker between microservices |
| **Cloud** | Cloud Run | v2 | Serverless container platform, with direct VPC egress |
| | Cloud Armor | — | Edge rate limiting and preconfigured WAF rules |
| | Secret Manager | — | Secure credential storage for external API keys |
| | Cloud Load Balancing | Global | HTTPS termination, path-based routing, Cloud CDN |
| | VPC | — | Private networking for Cloud Run to Redis, via direct VPC egress |
| | Cloud Monitoring | — | Uptime checks, alert policies and a per-environment budget |
| | Artifact Registry | — | Docker image repository with layer caching |
| **IaC** | OpenTofu | 1.12 | Infrastructure as Code (Terraform-compatible, open-source) |
| | Terragrunt | 1.1 | DRY configuration wrapper with dependency orchestration |
| **CI/CD** | Cloud Build | — | 7 path-filtered pipelines (build, scan, deploy) |
| | GitHub Actions | — | PR quality gates (lint, test, validate) |
| | Cloud Build Docker builder | — | Layer-cached image builds (replaced Kaniko, archived upstream) |
| | Trivy | 0.74 | Container filesystem scanning and IaC static analysis (replaced tfsec, retired upstream) |
| **Container** | Distroless | Java 25 | Minimal backend runtime (no shell, no package manager) |
| | nginx-unprivileged | Alpine | Lightweight frontend serving with SPA routing |

---

## Repository Structure

```
f1-visualizer/
|
+-- frontend/                                   # React 19 Single Page Application
|   +-- src/
|   |   +-- api/                                # Axios HTTP client + STOMP WebSocket client
|   |   |   +-- apiClient.ts                    #   Environment-aware Axios instance with JWT interceptor
|   |   |   +-- referenceApi.ts                 #   Drivers, sessions, stats endpoints
|   |   |   +-- ingestionApi.ts                 #   Live/simulation commands and playback control
|   |   |   +-- userApi.ts                      #   User profile and preferences
|   |   |   +-- stompClient.ts                  #   STOMP-over-SockJS with JWT authentication
|   |   +-- auth/                               # Auth0 integration
|   |   |   +-- AuthHandler.tsx                 #   Axios request interceptor (Bearer token injection)
|   |   |   +-- StompAuthHandler.tsx            #   WebSocket STOMP CONNECT authentication
|   |   +-- components/                         # React components
|   |   |   +-- RaceSimulator.tsx               #   Main live console: telemetry panels + circuit trace
|   |   |   +-- CircuitTrace.tsx                #   HTML5 Canvas real-time track visualization
|   |   |   +-- LapTimeChart.tsx                #   D3.js SVG multi-driver lap time line chart
|   |   |   +-- MediaController.tsx             #   Play/pause/seek for simulation replay
|   |   |   +-- ErrorBoundary.tsx               #   Auto-retry error boundary (3 attempts, 2s delay)
|   |   |   +-- layout/                         #   App shell, navigation, user settings modal
|   |   |   +-- selectors/                      #   Reusable driver and session autocomplete selectors
|   |   |   +-- splash/                         #   Post-login cinematic splash (background, circuit, progress)
|   |   |   +-- versus/                         #   Radar chart and animated stat comparison bars
|   |   +-- context/                            # React Context
|   |   |   +-- UserContext.tsx                 #   Global user profile + preferences state
|   |   +-- hooks/                              # Custom React hooks
|   |   |   +-- useTelemetry.ts                 #   STOMP subscription with 60fps buffered flush
|   |   |   +-- useLocation.ts                  #   STOMP subscription preserving all GPS points
|   |   +-- pages/                              # Route-level page components
|   |   |   +-- Landing.tsx                     #   Public login page (animated title, circuit, glow CTA)
|   |   |   +-- Home.tsx                        #   Live Console (RaceSimulator)
|   |   |   +-- HistoricalData.tsx              #   Data Vault (session search + lap charts)
|   |   |   +-- VersusMode.tsx                  #   Head-to-Head (radar + stat bars)
|   |   +-- types/                              # TypeScript interfaces
|   |   +-- utils/                              # D3 scale factories, coordinate projection, radar geometry
|   |   +-- App.tsx                             # Auth0 provider, theme, routing
|   |   +-- main.tsx                            # Vite entry point
|   +-- nginx.conf                              # SPA-aware nginx config for production
|   +-- Dockerfile                              # Multi-stage local build (Node -> nginx)
|   +-- Dockerfile.ci                           # Lean CI image (pre-built dist -> nginx)
|   +-- vite.config.ts                          # Dev server proxy to 4 backend services + WebSocket
|   +-- .env.dev / .env.uat / .env.prod         # Per-environment Auth0 + API config (Vite build modes)
|   +-- eslint.config.js                        # TypeScript-ESLint + React Hooks rules
|
+-- backend/                                    # Maven Multi-Module Spring Boot Microservices
|   +-- pom.xml                                 # Aggregator POM (Java 25)
|   +-- Dockerfile                              # Multi-stage local build (Maven -> distroless)
|   +-- Dockerfile.ci                           # Lean CI image (pre-extracted layers -> distroless)
|   |
|   +-- pom.xml                                 # The single parent: Boot 4.1.1, plugins, enforcer
|   +-- f1v-commons-web/                        #   Security filter chain, CORS, RFC 9457 errors, Actuator
|   +-- f1v-commons-gcp/                        #   BigQuery and Firestore clients, query guardrails
|   +-- f1v-commons-messaging/                  #   Redis topics and serializer, STOMP broker, MQTT
|   +-- f1v-commons-openf1/                     #   OpenF1 RestClient, auth token lifecycle, DTOs
|   |
|   +-- f1v-service-data-analysis/              # REST: BigQuery queries for laps, stats, reference data
|   +-- f1v-service-data-ingestion/             # REST: OpenF1 ingest, batch loaders, ingestion jobs
|   +-- f1v-service-replay-worker/              # Always-on: the replay engine and MQTT bridge
|   +-- f1v-service-telemetry/                  # WebSocket: Redis listener -> STOMP broadcaster
|   +-- f1v-service-user/                       # REST: Firestore user profiles and preferences
|
+-- infrastructure/                             # OpenTofu + Terragrunt IaC
|   +-- root.hcl                                # Terragrunt root: state, provider, retries
|   +-- README.md                               # Bootstrap order for a new project
|   +-- MIGRATIONS.md                           # Changes an apply cannot finish alone
|   +-- platform/                               # What all three environments share
|   +-- _envcommon/                             # 15 shared unit definitions
|   +-- policy/f1v.rego                         # Conftest rules run against the plan
|   +-- modules/                                # 11 reusable OpenTofu modules
|   |   +-- cloud-run/                          #   All six services, backend and SPA
|   |   +-- bigquery/                           #   Dataset + 8 tables, schemas in JSON
|   |   +-- firestore/                          #   Document database, PITR in prod
|   |   +-- redis/                              #   Memorystore (HA in production)
|   |   +-- networking/                         #   VPC, subnet, one firewall rule
|   |   +-- iam-and-secrets/                    #   6 runtime + 2 CI service accounts
|   |   +-- lb-api/                             #   Global HTTPS LB, path-routed
|   |   +-- lb-frontend/                        #   Global HTTPS LB + Cloud CDN
|   |   +-- monitoring/                         #   Uptime checks, alerts, budget
|   |   +-- cloudbuild-triggers/                #   7 path-filtered CI/CD triggers
|   |   +-- platform/                           #   State bucket, registries, DNS, audit
|   +-- environments/
|       +-- dev/    env.hcl + 15 units
|       +-- uat/    env.hcl + 15 units
|       +-- prod/   env.hcl + 15 units
|
+-- cloudbuild/                                 # GCP Cloud Build Pipeline Definitions
|   +-- backend-service.yaml                    # Build, scan, deploy: any backend service
|                                               #   (_MODULE, _IMAGE and _SERVICE per trigger)
|   +-- frontend.yaml                           # Lint, test, build, deploy: React SPA
|   +-- infrastructure.yaml                     # Scan, plan to file, policy, apply
|
+-- .github/
    +-- workflows/
        +-- pr-checks.yml                       # 5 PR jobs, including a real plan
        +-- pinned-versions.yml                 # Weekly: pins no ecosystem watches
```

---

## Backend Architecture

### Microservice Decomposition

The backend is composed of four independently deployable Spring Boot microservices, each with a single clearly-defined responsibility:

| Service | Type | Responsibility | GCP Dependencies |
|---------|------|---------------|-----------------|
| **data-ingestion** | WebFlux (Reactive) | Ingest live telemetry via MQTT, batch-load historical sessions from OpenF1 REST API, drive the replay engine | BigQuery, Redis, Secret Manager |
| **telemetry** | WebSocket/STOMP | Subscribe to Redis channels and broadcast to all connected WebSocket clients | Redis |
| **data-analysis** | Spring MVC (REST) | Serve lap times, driver statistics, session catalog, and reference data from BigQuery with Firestore caching | BigQuery, Firestore |
| **user** | Spring MVC (REST) | Manage user profiles and preferences with get-or-create semantics on first login | Firestore |

### Commons Modules

Four modules, each a slice of shared behaviour rather than a layer in a chain.
There were ten, five of which contained no Java at all — and the Redis and
Firestore configuration this section used to place here actually lived duplicated
in the services.

```
backend/pom.xml                    # The single parent and aggregator
|
+-- f1v-commons-web                # Security filter chain, CORS, the shared RFC 9457
|                                  # error shape, Actuator, metrics and tracing
+-- f1v-commons-gcp                # BigQuery and Firestore clients, the job timeout and
|                                  # byte ceiling every query runs with, the batch writer
+-- f1v-commons-messaging          # Redis topics and serializer, the replay command stream
|                                  # and state store, the STOMP broker, MQTT
+-- f1v-commons-openf1             # OpenF1 RestClient, credentials, token lifecycle, DTOs
```

Each service takes only what it needs: `f1v-service-telemetry` depends on `web`
and `messaging` and has no BigQuery or Firestore on its classpath at all. The
layering is asserted by `CommonsLayeringTest` rather than left as a convention.


### Key Backend Patterns

- **Scoped Maven Builds** — Each CI pipeline compiles only the target module and its transitive commons dependencies (`mvn -pl <module> -am`), avoiding a full monorepo rebuild on every change.
- **Spring Boot Layered JARs** — Production images use `java -Djarmode=layertools -jar ... extract` to split the fat JAR into four Docker layers (dependencies, loader, snapshots, application), maximizing cache reuse since dependency layers rarely change.
- **Stateless JWT Validation** — All services validate JWTs locally using the Auth0 JWKS endpoint. No session state exists anywhere in the backend — every request carries its own authentication context.
- **STOMP Channel Interceptor** — WebSocket connections are authenticated at the STOMP protocol level. The interceptor extracts the JWT from the CONNECT frame's Authorization header, validates it, and sets the security principal before any message routing occurs.
- **Scheduled Token Refresh** — The OpenF1 API client automatically refreshes its access token on a fixed schedule via `@Scheduled`, maintaining an always-valid credential without request-time auth overhead.
- **Windowed Replay Engine** — The Ingestion Service's replay engine processes historical sessions in 60-second chunks with async prefetching at 50% chunk progress, preventing OOM on multi-hour sessions. A single-threaded `ChunkLoader` executor serializes BigQuery queries to avoid overwhelming the data warehouse. Play, pause, and seek operations are exposed via REST endpoints and broadcast progress via Redis.
- **Reference Data Caching** — The Analysis Service holds driver, session, and circuit reference data in a Caffeine cache in front of Firestore, so data that changes only between seasons is read remotely once per TTL rather than once per request — including once per keystroke on the session search, which is what it used to do.
- **Async Data Loading** — The Ingestion Service uses `@EnableAsync` with `CompletableFuture` for non-blocking chunk prefetch coordination, and `@EnableScheduling` for the 250ms replay tick loop and 50-minute OpenF1 token refresh cycle.
- **Application Profiles** — Every service supports `local`, `dev`, `uat`, and `prod` profiles, with environment-specific configuration for database endpoints, Auth0 tenants, and Redis connectivity.

---

## Frontend Architecture

### Page Structure

| Route | Page | Key Components | Data Source |
|-------|------|---------------|-------------|
| `/` | Landing | Animated title (letter stagger), pulsing login button, circuit animation | Auth0 (login redirect) |
| `/dashboard` | Live Console | RaceSimulator, CircuitTrace (Canvas), MediaController, SessionControlPanel | STOMP WebSocket |
| `/historical` | Data Vault | Session search (Autocomplete), LapTimeChart (D3.js SVG), DataVaultLoader | REST API + BigQuery |
| `/versus` | Head-to-Head | DriverSelector (x2), RadarChart (D3.js SVG), StatComparisonBar (Framer Motion) | REST API + BigQuery |

All authenticated routes are wrapped by a `RequiredAuth` guard. On first login, a cinematic splash screen plays a ~7-second sequence (layered gradient background, circuit animation, progress bar, title reveal) while reference data (drivers, sessions) is prefetched in the background — eliminating skeleton loaders on subsequent page transitions.

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

### Frontend Resilience Patterns

- **Request Deduplication** — The `referenceApi` layer maintains global in-flight promise caches for drivers and sessions. Multiple components requesting the same data simultaneously share a single network call. A 3-second failure cooldown prevents 429 rate-limit cascading after transient errors.

- **Exponential Backoff (HTTP)** — Axios response interceptors retry 429 (Rate Limit) and network errors with exponential backoff (2s → 4s → 8s, up to 3 attempts). The `Retry-After` header is respected when present.

- **WebSocket Circuit Breaker** — The STOMP client caps reconnection at 6 attempts (5s → 10s → 20s → 40s → 60s → 60s, ~3 minutes total) with ±25% jitter to prevent thundering-herd reconnection storms. After exhausting attempts, the user must reload to recover.

- **Splash Prefetch Strategy** — The post-login splash animation (~7 seconds) runs concurrently with REST API prefetches for drivers and sessions, with 400ms stagger between requests. Once cached, in-memory hits eliminate network calls during route transitions.

- **60fps Buffer Architecture** — STOMP packets arrive at unpredictable rates but `useTelemetry` and `useLocation` accumulate them in `useRef` buffers (bypassing React's reconciliation), flushing to state only on `requestAnimationFrame` — ensuring smooth Canvas animation without triggering React re-render storms.

### Design System

- **Glassmorphism Theme** — A dark-mode-only broadcast aesthetic using MUI's theme system with `backdrop-filter: blur()` on Paper/AppBar surfaces, semi-transparent rgba backgrounds, and 1px rgba borders for frosted-glass depth.
- **Typography** — Titillium Web (the official F1 broadcast typeface family) with bold italic headings in uppercase letter-spacing and 1.1rem body text.
- **Team Colors** — Real Formula 1 team hex codes throughout visualizations, with automatic teammate color lightening for multi-driver charts.
- **Motion Design** — Framer Motion `AnimatePresence` handles page transitions, `layoutId` provides spring-physics shared layout animation for the active nav indicator (stiffness: 500, damping: 35), and staggered child animations create sequential reveal effects on landing and splash screens.

---

## Infrastructure as Code

### Module Architecture

Eleven OpenTofu modules under `infrastructure/modules/`, composed per environment
by Terragrunt. Each module has a README covering what it is for and which
decisions in it are load bearing.

```
infrastructure/
|
+-- platform/            What every environment shares: state bucket, both
|                        registries, the OpenF1 secrets, enabled APIs, DNS zone,
|                        audit logging, org policies. Outside environments/ so a
|                        `run --all` in one cannot destroy another's dependency.
|
+-- _envcommon/          One definition per unit type, included by all three
|                        environments.
|
+-- environments/<env>/  env.hcl, plus 15 units that are an include and, in nine
|                        cases, a genuine override.
|
+-- modules/
    +-- iam-and-secrets  6 runtime + 2 CI service accounts, least privilege
    +-- networking       VPC, subnet, one firewall rule (direct VPC egress)
    +-- firestore        Document database, PITR and backups in prod
    +-- bigquery         One dataset per environment, 8 tables
    +-- redis            Memorystore, with AUTH and its CA delivered by secret
    +-- cloud-run        All six services: five JVM backends and the SPA
    +-- lb-api           Global HTTPS LB routing straight to the services
    +-- lb-frontend      Global HTTPS LB for the SPA, with Cloud CDN
    +-- cloudbuild-triggers  7 path-filtered triggers
    +-- monitoring       Uptime checks, alert policies, budget
    +-- platform         The shared layer above
```

### Dependency Orchestration

Terragrunt derives the order from `dependency` blocks. Every edge is a real
output reference — a NEG or a trigger naming a resource as a bare string is how a
first bootstrap used to fail and every run after it succeed by accident.

```
platform (applied separately, rarely)

iam-and-secrets --+--> cloud-run (all six) --+--> lb-api
                  |                          +--> lb-frontend
                  +--> bigquery -------------+
                  +--> cloudbuild-triggers
networking -------+--> redis ----------------+
firestore
monitoring
```

### Key Infrastructure Patterns

- **Environment facts stated once** — `environments/<env>/env.hcl` holds
  everything true of one environment: project, region, Auth0 tenant, database
  and dataset ids, registry host and image tag, domains, branch pattern, and an
  `is_production` flag. `root.hcl` reads it, `_envcommon/*.hcl` build the units
  from it. A unit contains only what genuinely differs.

- **The pipeline owns the image; IaC owns everything else** — both Cloud Run
  paths ignore `template.containers.image` and `traffic`. Without that, an
  infrastructure apply reads the SHA tag from state, sees the floating tag in
  configuration, and rolls a revision from whatever was built last — which,
  because dev and prod share a registry, could be a dev build. Images are tagged
  `latest-<env>`.

- **GCS remote state** — one object per unit under
  `environments/<env>/<unit>/terraform.tfstate`. The bucket is declared in the
  platform layer with versioning, uniform access and public-access prevention;
  it holds the Memorystore AUTH string in clear text, so it is not a bucket to
  leave unmanaged.

- **Direct VPC egress** — services that reach Redis attach to the subnet
  directly. The three always-on Serverless VPC Access connectors they replaced
  were a fixed monthly cost and a shared bandwidth ceiling on the busiest path in
  the system.

- **CORS at the load-balancer edge** — every REST path rule carries a
  `cors_policy`, so OPTIONS is answered at the edge with a 204. A non-2xx
  preflight makes the browser block the real request, whose retries then compound
  whatever caused it; this removes the whole failure mode. `cors_policy` does not
  inherit into a path rule, so it is stated per rule.

- **Cloud CDN** — in front of the SPA, and in front of the analysis service's six
  reference endpoints, which the origin already marks `public, max-age=3600`.
  A response marked public is served from the edge on the cache key alone, and
  the default key excludes Authorization, so those endpoints answer without a
  token once warm. That is a deliberate trade for public F1 reference data; the
  alternative is one line in `modules/lb-api/main.tf`.

- **Warm instances in prod only** — prod keeps one instance of each REST service
  and of telemetry, because the splash screen prefetches reference data and
  `/users/me` is called on every authentication. dev scales everything to zero;
  uat keeps the replay worker and telemetry, which is what it exists to rehearse.

- **Two CI identities** — the pipelines that run `./mvnw verify` and
  `yarn install` execute third-party code, so they hold no IAM, network or data
  administration at all. Only the infrastructure pipeline can change the estate,
  and its `projectIamAdmin` grant is conditioned to the roles this repository
  declares, so it cannot grant itself Owner.

- **Scoped IAM** — each service runs under its own account, and data access is
  granted on the resource rather than the project. dev, uat and prod share one
  GCP project, so a project-level grant crosses every environment boundary:

  | Service | Holds |
  |---|---|
  | Analysis | `bigquery.jobUser`; dataViewer on its own dataset; `datastore.user` conditioned to its own database |
  | Ingestion | `bigquery.jobUser`; dataEditor on its own dataset; `datastore.user` conditioned; secretAccessor on the Redis and OpenF1 secrets |
  | Replay worker | `bigquery.jobUser`; dataViewer on its own dataset; secretAccessor on the Redis and OpenF1 secrets |
  | Telemetry | secretAccessor on the Redis AUTH and CA secrets, and nothing at project level |
  | User | `datastore.user` conditioned to its own database |
  | Frontend | Nothing, anywhere |

- **Migrations** — changes that an apply cannot finish on its own, with the
  commands and the order, are in
  [`infrastructure/MIGRATIONS.md`](infrastructure/MIGRATIONS.md). The bootstrap
  order for a project that does not exist yet is in
  [`infrastructure/README.md`](infrastructure/README.md).

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
    |   PR Checks    |   7 triggers   |   7 triggers   |   7 triggers   |
```

### Branch Responsibilities

| Branch | Purpose | Deploys To | Trigger |
|--------|---------|-----------|---------|
| `main` | Development trunk — all feature branches merge here | Nothing (validation only) | GitHub Actions PR checks |
| `dev` | Development environment deployment | GCP Dev | Cloud Build on push (7 path-filtered triggers) |
| `uat` | User acceptance testing deployment | GCP UAT | Cloud Build on push |
| `prod` | Production deployment | GCP Prod | Cloud Build on push; the infrastructure trigger requires approval |

### Promotion Flow

Each promotion is an explicit pull request from one environment branch to the next, creating a clear audit trail:

1. **feature → main** — Developer opens a PR. GitHub Actions runs backend tests, frontend lint, tests and e2e, infrastructure static checks, and a real `terragrunt plan` per environment posted as a comment. On merge, the code is integrated but not yet deployed.
2. **main → dev** — A promotion PR deploys to the dev environment. Cloud Build pipelines build, scan, containerize, and deploy all affected services.
3. **dev → uat** — After dev validation, a promotion PR moves the release candidate to the UAT environment for acceptance testing.
4. **uat → prod** — After UAT sign-off, a promotion PR deploys to production. The infrastructure trigger holds its apply for manual approval in prod (`approval_config` in `modules/cloudbuild-triggers`), so a merge cannot apply a plan nobody read — including a destroy. The application triggers do not: the frontend pipeline gates itself with deploy-no-traffic, smoke test, promote, and a backend deploy is reversible by re-running at an earlier SHA.

### Down-Merge Flow

When a hotfix or conflict resolution introduces commits directly on an environment branch (e.g., an urgent fix applied to `prod`), those changes must flow back upstream to prevent branch divergence. Down-merges ensure every branch remains a superset of the branches below it:

```
prod             uat              dev              main
  |                |                |                |
  |   Down-merge   |                |                |
  +--------------->|                |                |
  |                |   Down-merge   |                |
  |                +--------------->|                |
  |                |                |   Down-merge   |
  |                |                +--------------->|
  |                |                |                |
```

1. **prod → uat** — Merge `prod` back into `uat` via PR so the UAT branch has the hotfix.
2. **uat → dev** — Merge `uat` back into `dev` via PR so the dev branch stays in sync.
3. **dev → main** — Merge `dev` back into `main` via PR so the trunk contains all changes.

Each down-merge should be performed via a pull request for audit trail consistency. The goal is to ensure `main` always contains the superset of all changes — no fix should exist in production that isn't also in `main`.

**Preferred approach — avoid down-merges entirely:** Since `main` is the trunk where all work originates, even hotfixes should be branched off `main`, merged via PR, and then fast-tracked through the promotion chain (`main → dev → uat → prod`). This keeps the flow strictly unidirectional and eliminates the need for down-merges altogether.

---

## CI/CD Pipeline

### Dual-Layer Pipeline Strategy

The CI/CD system operates across two layers: **GitHub Actions** for fast PR validation on `main`, and **GCP Cloud Build** for environment deployment on promotion branches.

```
Pull Request to main                        Promotion to env branch (dev/uat/prod)
    |                                             |
    v                                             v
GitHub Actions (5 jobs)                     Cloud Build (7 path-filtered triggers,
    |                                        3 pipeline definitions)
    +-- Backend                                   |
    +-- Frontend                                  +-- backend-service.yaml  (x5,
    +-- Frontend E2E (needs: frontend)            |   one trigger per service)
    +-- Infrastructure static checks              +-- frontend.yaml
    +-- Infrastructure plan (needs: above,        +-- infrastructure.yaml
        one job per environment, WIF)
```

The five backend services share one pipeline definition: the triggers differ only
in three substitutions. The API Gateway pipeline is gone with the gateway itself.

### PR Quality Gates (GitHub Actions)

Every pull request targeting `main` runs:

| Job | Steps | Purpose |
|-----|-------|---------|
| **Backend** | `mvn -B clean verify`, Trivy filesystem scan, SBOM upload | The whole reactor through `verify`, which is the phase every check binds to — `package` stops short of all of them |
| **Frontend** | `yarn audit`, `format:check`, `lint`, `typecheck`, `test:coverage`, `build`, `size` | Lint, types, coverage thresholds and a gzipped bundle budget |
| **Frontend E2E** | Playwright, desktop and mobile viewports, axe at both | The only layer exercising the Auth0 redirect, real STOMP frames and canvas resize |
| **Infrastructure static checks** | `tofu fmt`, `terragrunt hcl fmt`, module validate with `-lockfile=readonly`, `terragrunt hcl validate --inputs --strict`, `tflint`, Trivy | Formatting, undeclared inputs and provider drift, all of which used to reach `main` green |
| **Infrastructure plan** | `terragrunt run --all -- plan` per environment, posted as a PR comment | The plan a reviewer approves. It runs through Workload Identity Federation as a read-only planner — no service-account key, and it cannot apply |

### Environment Pipelines (Cloud Build)

Each Cloud Build pipeline is triggered only when files matching its path filter are pushed to an environment branch. The five backend services share `backend-service.yaml`; the triggers differ in three substitutions:

```
1. Scoped Maven Build       mvn -B clean verify -pl <module> -am
         |
2. Layer Extraction         java -Djarmode=layertools -jar ... extract
         |
3. Trivy Security Scan      trivy filesystem --severity CRITICAL,HIGH
         |
4. Docker Image Build       Layer-cached build (--cache-from) -> Artifact Registry
         |
5. Cloud Run Deploy         gcloud run services update --image=<sha-tagged>
```

Images are pushed as both `:<sha>` and `:latest-<env>`. The environment suffix
matters: dev and prod are both in us-central1 and therefore share one registry,
so a bare `:latest` was one tag across all three environments.

The frontend pipeline extends this with lint and test gates:

```
1. Install Dependencies     yarn install (Node 26 Alpine + native canvas deps)
         |
2. ESLint Check             yarn lint
         |
3. Unit + Visual Tests      yarn test:ci (Vitest + jest-image-snapshot)
         |
4. Production Build         yarn build --mode ${_ENV}
         |
5. Docker Image Build       Layer-cached build (--cache-from) -> Artifact Registry
         |
6. Cloud Run Deploy         gcloud run services update --image=<sha-tagged>
```

The infrastructure pipeline plans to a file and applies that file:

```
1. Install Tools            OpenTofu 1.12.6 + Terragrunt 1.1.4, each verified
         |                  against the SHA256SUMS published with its release
2. Trivy IaC Scan           trivy config over infrastructure/ (fast first pass)
         |
3. Terragrunt Init          terragrunt run --all -- init  (shared provider cache)
         |
4. Terragrunt Plan          plan -out=tfplan --out-dir /workspace/plans
         |                  -detailed-exitcode: no changes skips the apply
5. Plan Scan                trivy config --tf-plan  (values resolved, unlike (2))
         |
6. Policy Check             conftest against infrastructure/policy/f1v.rego
         |
7. Terragrunt Apply         apply tfplan — the plans from (4), not a re-plan
```

Steps 5 and 6 are the ones that see anything: `is_public`, `ingress`,
`deletion_protection` and every secret reference arrive as Terragrunt inputs, so
a scan of the modules alone logs "Variable values were not found" and finds only
what has no variable in it. In prod, step 7 waits for manual approval.

### Key CI/CD Patterns

- **Path-Filtered Triggers** — Each trigger specifies `included_files` globs scoped to the relevant service directory plus its shared commons dependencies. A change to only the User Service triggers only that service's build — not the other four. The five backend triggers share one parameterized pipeline, `backend-service.yaml`, rather than a copy each.

- **Immutable Image Tags** — Every image is tagged with the git commit SHA (`${SHORT_SHA}`) in addition to `latest`. Cloud Run deployments reference the SHA tag, ensuring every deployment is traceable to an exact commit.

- **Lean CI Dockerfiles** — Separate `Dockerfile.ci` files accept pre-built artifacts (extracted JAR layers for backend, `dist/` for frontend) from earlier Cloud Build steps, eliminating the double-compilation that would occur with a standard multi-stage Dockerfile.

- **Layer-Cached Builds** — Image builds seed the Docker layer cache from the previously published tag (`--cache-from`), so unchanged layers are reused across builds. This replaced Kaniko's `--cache-repo` model after Kaniko was archived upstream.

- **Pre-Image Security Scanning** — Trivy scans the extracted JAR filesystem before the Docker image is built. This fails fast on vulnerabilities without wasting time building an image that would be rejected.

- **Apply the Plan That Was Reviewed** — The infrastructure pipeline writes each unit's plan to a file and applies that file, rather than running `apply -auto-approve`, which re-plans. The apply cannot differ from the plan in the log, and in prod it waits for manual approval first.

---

## Testing

The project maintains a comprehensive multi-layered testing strategy spanning unit, integration, component, visual regression, and security testing across all three pillars of the monorepo.

### Backend Test Suite

**Framework:** JUnit 5 (Jupiter 6.1.3) with Mockito, Spring Boot Test 4.1.1

All backend dependencies are managed by the single `f1v-parent` POM, which inherits Spring Boot's and imports the Spring Cloud GCP BOM; `maven-enforcer-plugin` fails the build if a transitive version resolves below what something asked for. Each service has its own `src/test/java/` and `src/test/resources/` trees with environment-specific test profiles.

| Category | Framework / Tool | Description |
|----------|-----------------|-------------|
| **Unit Tests** | JUnit 5 + Mockito | Isolated service-layer testing with `@ExtendWith(MockitoExtension.class)`, `@Mock`, and `@InjectMocks`. Covers scoring algorithms, data loaders, replay engine logic, and repository interactions. |
| **Controller Tests** | Spring `@WebMvcTest` | Lightweight Spring context tests for REST controllers with `MockMvc`. Validates request mapping, JSON serialization, HTTP status codes, and error handling without starting a full server. |
| **Security Tests** | Spring Security Test | OAuth2 JWT authentication testing using `SecurityMockMvcRequestPostProcessors.jwt()` to inject mock tokens with configurable subjects and claims. Validates endpoint authorization across all secured controllers. |
| **Reactive Tests** | Reactor Test (`StepVerifier`) | Verifies non-blocking `Flux`/`Mono` streams in the Ingestion Service's OpenF1 client and data pipeline using `StepVerifier.create().expectNextMatches().verifyComplete()`. |
| **HTTP Mock Tests** | OkHttp `MockWebServer` | Embeds a local HTTP server to test external API client behavior — request construction, response parsing, error handling, and retry logic — without network calls to the real OpenF1 API. |
| **Serialization Tests** | Jackson 3 + `JsonMapper` | Validates DTO serialization/deserialization roundtrips for all OpenF1 data transfer objects, ensuring JSON contract stability. |
| **Parameterized Tests** | JUnit `@ParameterizedTest` + `@CsvSource` | Data-driven tests for the driver scoring algorithms (speed, consistency, experience, aggression, tire management), running each scoring function against multiple input/output pairs from inline CSV data. |

**Test Profiles:** Each service defines an `application-test.yml` with a test-specific Auth0 issuer (`https://test-issuer.example.com/`), a test API audience, and a dummy BigQuery dataset — ensuring tests never touch real cloud resources.

**Test Fixtures:** The Ingestion Service maintains JSON fixtures in `src/test/resources/fixtures/` (`openf1-lap-data.json`, `openf1-car-data.json`, `openf1-location-data.json`, `openf1-position-data.json`, `openf1-session.json`, `openf1-stint-data.json`) for deterministic deserialization and data loading tests.

**Test Execution:**
```bash
# Full backend test suite (all modules)
cd backend && ./mvnw -B clean verify

# Scoped test run (single service + its commons dependencies)
cd backend && ./mvnw -B clean verify -pl f1v-service-data-analysis -am
```

### Frontend Test Suite

**Framework:** Vitest 5.0 with React Testing Library, jsdom 30, jest-image-snapshot

**Configuration:** the `test` block in `vite.config.ts` — jsdom environment, global test APIs enabled, `@` path alias resolved from `tsconfig.app.json`, and a setup file (`src/test/setup.ts`) that polyfills `ResizeObserver`, `requestAnimationFrame`/`cancelAnimationFrame`, and configures automatic React Testing Library cleanup between tests.

| Category | Framework / Tool | Description |
|----------|-----------------|-------------|
| **Component Tests** | React Testing Library | Renders React components with `render()` and asserts on DOM output, user interactions (`fireEvent`), and async state updates (`waitFor`, `act`). Spans 22 component test files including `CircuitTrace`, `LapTimeChart`, `RadarChart`, `RaceSimulator`, `SessionControlPanel`, and `VersusMode`. |
| **Visual Regression Tests** | jest-image-snapshot + node-canvas | Renders the `CircuitTrace` component to a Node.js Canvas and compares pixel-level output against stored PNG baseline snapshots with a failure threshold of 0.01%. Baselines stored in `src/components/__tests__/__image_snapshots__/`. |
| **Hook Tests** | `renderHook()` from React Testing Library | Tests custom React hooks (`useTelemetry`, `useLocation`) in isolation, validating STOMP subscription lifecycle, message buffering, and callback invocation patterns. |
| **Utility Tests** | Vitest | Pure function tests for D3 scale factories (`chartScales`), world-to-canvas coordinate projection (`circuitProjection`), and radar chart geometry calculations (`radarGeometry`). |
| **API Client Tests** | Vitest + `vi.stubEnv()` | Validates Axios instance configuration across deployment environments (dev, uat, prod) and STOMP client initialization with JWT authentication headers. |
| **Auth Tests** | Vitest | Tests the Auth0 Axios interceptor (`AuthHandler`) for Bearer token injection and 401 response handling. |
| **Error Boundary Tests** | React Testing Library | Validates the auto-retry error boundary's fallback rendering, retry attempts, and error recovery behavior. |

**Mocking Patterns:**
- **D3.js** — Complex fluent API chains mocked as chainable objects that track method calls (`textCalls`, `styleCalls`, `appendCallCount`) for assertion.
- **Canvas API** — `HTMLCanvasElement.prototype.getContext` spied to intercept and verify `beginPath()`, `moveTo()`, `lineTo()`, `stroke()`, `arc()`, and `fill()` draw operations.
- **STOMP/WebSocket** — Full mock of `@stomp/stompjs` Client class and `sockjs-client`, returning controllable `{ id, unsubscribe }` subscription objects.
- **Auth0** — `useAuth0` hook mocked to return configurable authentication state and token accessors.

**Visual Regression Baselines** (5 snapshots):
- `circuit-trace-oval-selected.png` — Selected driver with team-color trace
- `circuit-trace-oval-small.png` — Scaled-down canvas rendering
- `circuit-trace-ferrari-red.png` — Ferrari team color verification
- `circuit-trace-ghost-selected.png` — Ghost driver overlay rendering
- `circuit-trace-single-driver.png` — Single driver trace path

**Test Execution:**
```bash
# Full frontend test suite (CI mode — single run, no watch)
cd frontend && yarn test:ci

# Watch mode for development
cd frontend && yarn vitest
```

### Infrastructure Testing

| Category | Tool | Description |
|----------|------|-------------|
| **Security Scanning** | Trivy (`config`) | Two passes. Over `infrastructure/` on every PR, which is fast but blind to anything that arrives as a Terragrunt input — that is, to every security-relevant decision here. And over the rendered plan in Cloud Build, where the values are resolved. Accepted findings are recorded in `.trivyignore` with the reason. Replaced tfsec, which was retired and folded into Trivy. |
| **Policy** | Conftest / OPA | `infrastructure/policy/f1v.rego`, run against the same rendered plan: no project-level data or secret role without an IAM condition, no owner/editor anywhere, no Cloud Run service without a service account, no `allUsers` outside an allow-list, no bare `:latest` image, prod implies deletion protection, no proxy on the default SSL policy, no backend service without request logging. |
| **Linting** | tflint + Google ruleset | Catches invalid values, deprecated arguments and undocumented variables that `validate` accepts because they are only wrong at the API. |
| **Module Validation** | OpenTofu `validate` | Each module validated in isolation, with `-lockfile=readonly` so a run that would change a committed lock file fails rather than silently resolving a different provider build. |
| **Input Validation** | `terragrunt hcl validate --inputs --strict` | Catches an input that no variable declares — which is how `tier = "STANDARD_HA"` sat in the prod redis unit being exported and ignored. |
| **Deployment Planning** | Terragrunt `plan` | A plan per environment on every PR, posted as a comment, so a reviewer approves a promotion having seen what it changes. In Cloud Build the plan is written to a file and that file is applied — not re-planned — so the apply is the plan that was reviewed. |
| **Container Scanning** | Trivy | Filesystem-level vulnerability scanning of all backend service JARs before Docker image construction. Configured with `--exit-code 1 --severity CRITICAL,HIGH` — any critical or high-severity CVE fails the build immediately. |

### Test Distribution Summary

| Layer | Test Files | Test Framework | Test Types |
|-------|-----------|---------------|------------|
| **Backend** | 29 files, 182 tests | JUnit 5, Mockito, Spring Boot Test | Unit, controller, security, reactive, serialization, parameterized |
| **Frontend** | 38 files, 188 tests | Vitest, React Testing Library | Component, visual regression, hook, utility, API client, auth |
| **Infrastructure** | 11 modules, 46 units | Trivy, Conftest, tflint, OpenTofu, Terragrunt | Plan-based security scanning, policy checks, linting, module and input validation |

### CI Test Integration

Tests execute at two stages in the delivery pipeline:

1. **PR Quality Gate (GitHub Actions)** — Five jobs run on every pull request to `main`:
   - Backend: `mvn -B clean verify` (the whole reactor through the phase the checks bind to), Trivy filesystem scan, SBOM upload
   - Frontend: audit, format, lint, typecheck, coverage, build, bundle budget
   - Frontend E2E: Playwright across a desktop and a mobile viewport, axe at both
   - Infrastructure static checks: formatting, module and input validation, tflint, Trivy
   - Infrastructure plan: a real `terragrunt plan` per environment, commented on the PR

2. **Deployment Pipeline (Cloud Build)** — Tests re-run as part of each service's build-scan-deploy pipeline on environment branches (`dev`, `uat`, `prod`). The frontend pipeline additionally installs native C++ dependencies (Cairo, Pango, Python, g++) on Alpine Linux to support the `canvas` package required by the visual regression test suite.

---

## Security Architecture

Security is enforced at every layer of the stack:

| Layer | Mechanism | Detail |
|-------|----------|--------|
| **Identity** | Auth0 (OAuth2/OIDC) | All user authentication via Auth0 with PKCE flow |
| **API Authentication** | JWT (RS256) | Every HTTP request validated against Auth0 JWKS endpoint |
| **WebSocket Authentication** | STOMP Interceptor | JWT validated on CONNECT frame before topic subscription |
| **Edge Rate Limiting** | Cloud Armor | 300 REST requests and 20 WebSocket handshakes per client IP per minute, plus preconfigured sqli/xss/lfi/rce rule sets at sensitivity 1 |
| **TLS** | SSL policy, HSTS | TLS 1.2 minimum with the MODERN cipher profile on both edges; `http://` redirects rather than refusing |
| **Network Isolation** | VPC + direct egress | Redis has no public IP and one firewall rule reaches it, on TCP 6379 from the services' subnet |
| **Redis** | AUTH + TLS | The instance requires a credential and encrypts the connection; the services are given its CA to verify against |
| **IAM** | Per-Service Accounts | 6 runtime identities, each holding only what its service needs, with data and secret access granted on the resource rather than the project |
| **CI Identity** | Split by trust | The pipelines that run third-party build code hold no IAM, network or data administration; only the infrastructure pipeline can change the estate, and it cannot grant itself Owner |
| **Audit** | Data Access logs | Secret Manager, Firestore and BigQuery reads and writes are recorded, with 90-day retention |
| **Secrets** | Secret Manager | Credentials are declared in IaC and their values added out of band, so they never enter state; each is granted to the one or two accounts that consume it |
| **Container Hardening** | Distroless Images | No shell, no package manager — minimal attack surface |
| **IaC Scanning** | Trivy + Conftest | Scanned against the rendered plan, where the values are resolved, plus a policy layer encoding the rules from the 2026-09-09 audit |
| **Image Scanning** | Trivy | Filesystem vulnerability scan on every backend build |
| **Session Policy** | Stateless | No server-side sessions; CSRF disabled (JWT-only auth) |
| **CORS** | Edge preflight | The load balancer answers OPTIONS with a 204 per path rule, which removes the retry cascade a failed preflight used to cause; Spring CORS remains for the origin |

---

## Environment Configuration

Three environments share the module code and the unit definitions in
`_envcommon/`. Everything below lives in `environments/<env>/env.hcl`, which is
the only place any of it is written down:

| Dimension | Dev | UAT | Prod |
|-----------|-----|-----|------|
| **Region** | us-central1 | us-east1 | us-central1 |
| **Branch Trigger** | `^dev$` | `^uat$` | `^prod$` |
| **API Domain** | dev.api.f1visualizer.com | uat.api.f1visualizer.com | api.f1visualizer.com |
| **Frontend Domain** | dev.f1visualizer.com | uat.f1visualizer.com | f1visualizer.com |
| **Auth0 Tenant** | elysianarts-dev | elysianarts-uat | elysianarts |
| **Firestore DB** | f1v-db-dev | f1v-db-uat | f1v-db-prod |
| **BigQuery Dataset** | f1_dataset_dev | f1_dataset_uat | f1_dataset_prod |
| **Image Tag** | latest-dev | latest-uat | latest-prod |
| **Redis Tier** | BASIC (single node) | BASIC (single node) | STANDARD_HA (automatic failover) |
| **Firestore Protection** | None | 3-day backups | Delete protection, PITR, 14-day backups |
| **Subnet** | 10.0.0.0/24 | 10.0.0.0/24 | 10.0.0.0/24 |
| **Warm Instances** | None | Replay worker + telemetry | All six services |
| **Alerting** | Policies defined, not enabled | Enabled | Enabled |
| **Infrastructure Apply** | Automatic | Automatic | Manual approval |

The subnets can share a range because each environment has its own VPC.

All three still share one GCP project (`f1v-example-project`) and one Artifact
Registry repository per region. That is the remaining structural compromise: IAM
conditions and per-resource grants keep dev out of prod's data, but a project is
the real isolation boundary and this estate does not have one per environment.
The path to fixing it is one project per environment under a folder, with the
platform layer where it already is.

---

## Disclaimer

*F1 Visualizer is an unofficial, open-source personal project and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.*
