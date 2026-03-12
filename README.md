# F1 Visualizer

> *An enterprise-grade, cloud-native Formula 1 telemetry and historical data visualization platform.*

<p align="center">
  <!-- Frontend -->
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7.3" />
  <img src="https://img.shields.io/badge/D3.js-7-F9A03C?style=for-the-badge&logo=d3dotjs&logoColor=white" alt="D3.js" />
  <img src="https://img.shields.io/badge/MUI-7.3-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
  <br />
  <!-- Backend -->
  <img src="https://img.shields.io/badge/Java-25-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 25" />
  <img src="https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 4.0" />
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
  <img src="https://img.shields.io/badge/API_Gateway-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="API Gateway" />
  <br />
  <!-- IaC -->
  <img src="https://img.shields.io/badge/OpenTofu-1.9-FFDA18?style=for-the-badge&logo=opentofu&logoColor=black" alt="OpenTofu 1.9" />
  <img src="https://img.shields.io/badge/Terragrunt-0.77-E5F2FC?style=for-the-badge&logo=terraform&logoColor=5C4EE5" alt="Terragrunt 0.77" />
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
    +------------------+                +--------v---------+               +--------------------+
    |                  |   HTTPS/WSS    |                  |   HTTPS       |                    |
    |   React SPA      +--------------->+  Global HTTPS    +<------------->+   Google Cloud     |
    |   (Cloud Run)    |                |  Load Balancer   |               |   API Gateway      |
    |                  |                |                  |               |   (OpenAPI 2.0)    |
    +------------------+                +----+--------+----+               +----+----------+----+
                                             |        |                         |          |
                                        /ws  |        | /*                      |          |
                                             |        |            +------------+          |
                              +--------------+        +----------->+                       |
                              |                                    |   Path-Based          |
                              v                                    |   Routing             |
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
| | TypeScript | 5.9 | Static type safety across the codebase |
| | Vite | 7.3 | Build tooling with HMR and environment modes |
| | D3.js | 7 | Canvas and SVG data visualizations (circuit trace, line charts, radar charts) |
| | HTML5 Canvas | — | High-performance 60fps circuit trace rendering |
| | Material UI | 7.3 | Component library with dark-mode glassmorphism theme |
| | Framer Motion | 12 | Page transitions, letter-stagger reveals, spring-physics nav indicators, stat bars |
| | @stomp/stompjs | 7.3 | STOMP protocol client over SockJS WebSocket transport |
| | Axios | 1.13 | HTTP client with JWT interceptor, retry logic, and 429 backoff |
| | Emotion | 11.14 | CSS-in-JS styling engine powering MUI's theme layer |
| | date-fns | 4.1 | Lightweight date manipulation utilities |
| | Auth0 React SDK | 2.15 | OAuth2/OIDC authentication flow with PKCE |
| **Backend** | Java | 25 | Language runtime (Temurin distribution) |
| | Spring Boot | 4.0 | Microservice framework |
| | Spring Security | 7.x | OAuth2 Resource Server with JWT validation |
| | Spring WebSocket | — | STOMP message broker with SockJS fallback |
| | Spring WebFlux | — | Reactive non-blocking HTTP for the Ingestion Service |
| | Spring Cloud GCP | 7.4.5 | GCP service integration (BigQuery, Firestore, Secret Manager) |
| | Eclipse Paho | 1.2.5 | MQTT 3.1.1 client for OpenF1 live data stream (QoS 1) |
| | Project Reactor | 3.8.3 | Reactive streams for non-blocking data ingestion pipeline |
| | Jackson 3 | 3.1.0 | JSON serialization with SNAKE_CASE convention |
| | Lombok | 1.18.42 | Boilerplate reduction (@Builder, @Data) |
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
|   +-- vitest.config.ts                        # jsdom test environment with setup
|   +-- .env.dev / .env.uat / .env.prod         # Per-environment Auth0 + API config (Vite build modes)
|   +-- eslint.config.js                        # TypeScript-ESLint + React Hooks rules
|
+-- backend/                                    # Maven Multi-Module Spring Boot Microservices
|   +-- pom.xml                                 # Aggregator POM (Java 25)
|   +-- Dockerfile                              # Multi-stage local build (Maven -> distroless)
|   +-- Dockerfile.ci                           # Lean CI image (pre-extracted layers -> distroless)
|   |
|   +-- f1v-commons-parent/                     # Spring Boot 4.0.3 parent POM
|   +-- f1v-commons-bom/                        # Bill of Materials (10 shared libraries)
|   |   +-- f1v-commons-base/                   #   Lombok, base model annotations
|   |   +-- f1v-commons-security/               #   OAuth2 JWT resource server, CORS policy, STOMP auth
|   |   +-- f1v-commons-service-base/           #   WebMvc, Actuator, Jackson 3, Secret Manager client
|   |   +-- f1v-commons-service-rest/           #   REST service foundation (extends service-base)
|   |   +-- f1v-commons-service-reactive/       #   WebFlux foundation (extends service-base)
|   |   +-- f1v-commons-service-websocket/      #   STOMP + MQTT dependencies
|   |   +-- f1v-commons-gcp-bq/                 #   BigQuery client configuration
|   |   +-- f1v-commons-gcp-firestore/          #   Firestore client configuration
|   |   +-- f1v-commons-gcp-memorystore-redis/  #   Redis template + Pub/Sub listener config
|   |   +-- f1v-commons-api-openf1/             #   OpenF1 REST + MQTT client, auth token management
|   |
|   +-- f1v-service-data-analysis/              # REST: BigQuery queries for laps, stats, reference data
|   +-- f1v-service-data-ingestion/             # Reactive: OpenF1 ingest, batch loaders, replay engine
|   +-- f1v-service-telemetry/                  # WebSocket: Redis listener -> STOMP broadcaster
|   +-- f1v-service-user/                       # REST: Firestore user profiles and preferences
|
+-- infrastructure/                             # OpenTofu + Terragrunt IaC
|   +-- root.hcl                                # Terragrunt root config (GCS state backend)
|   +-- modules/                                # 12 reusable OpenTofu modules
|   |   +-- cloud-run-backend/                  #   Serverless container services for Maven/Java/SpringBoot
|   |   +-- cloud-run-frontend/                 #   Serverless container services for Vite/React/Typescript
|   |   +-- api-gateway/                        #   OpenAPI-driven request routing
|   |   +-- bigquery/                           #   Dataset + 7 tables with partitioning/clustering
|   |   +-- firestore/                          #   Document database with delete protection
|   |   +-- redis/                              #   Memorystore instance (HA in production)
|   |   +-- artifact-registry/                  #   Docker image repository
|   |   +-- networking/                         #   VPC, subnets, firewall rules, VPC connector
|   |   +-- iam-and-secrets/                    #   6 service accounts with scoped IAM bindings
|   |   +-- lb-api/                             #   Global HTTPS LB with WebSocket path bypass
|   |   +-- lb-frontend/                        #   Global HTTPS LB for React SPA
|   |   +-- cloudbuild-triggers/                #   7 path-filtered CI/CD triggers
|   +-- environments/
|   |   +-- dev/                                # DEV environment Terragrunt configurations
|   |       +-- (16 module instances with dependency declarations)
|   |   +-- prod/                               # PROD environment Terragrunt configurations
|   |       +-- (16 module instances with dependency declarations)
|   |   +-- uat/                                # UAT environment Terragrunt configurations
|   |       +-- (16 module instances with dependency declarations)
|   +-- openapi.yaml                            # API Gateway OpenAPI 2.0 specification
|
+-- cloudbuild/                                 # GCP Cloud Build Pipeline Definitions
|   +-- backend-data-analysis.yaml              # Build, scan, deploy: Analysis Service
|   +-- backend-data-ingestion.yaml             # Build, scan, deploy: Ingestion Service
|   +-- backend-telemetry.yaml                  # Build, scan, deploy: Telemetry Service
|   +-- backend-user.yaml                       # Build, scan, deploy: User Service
|   +-- frontend.yaml                           # Lint, test, build, deploy: React SPA
|   +-- api-gateway.yaml                        # Discover URLs, inject, validate, deploy, smoke test
|   +-- infrastructure.yaml                     # tfsec scan, Terragrunt init/plan/apply
|
+-- .github/
    +-- workflows/
        +-- pr-checks.yml                       # 3 parallel PR jobs: backend, frontend, infrastructure
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

### Commons Bill of Materials

All microservices compose their dependencies from a shared BOM of 10 internal libraries. This ensures consistent versions, shared security configuration, and zero duplication of infrastructure concerns:

```
f1v-commons-bom
|
+-- f1v-commons-base                   # Lombok, base annotations
+-- f1v-commons-security               # OAuth2 JWT, CORS, STOMP auth interceptor
+-- f1v-commons-service-base           # WebMvc, Actuator, Jackson 3, Secret Manager
+-- f1v-commons-service-rest           # REST service foundation
+-- f1v-commons-service-reactive       # WebFlux reactive foundation
+-- f1v-commons-service-websocket      # STOMP broker, MQTT client
+-- f1v-commons-gcp-bq                 # BigQuery client bean
+-- f1v-commons-gcp-firestore          # Firestore client bean
+-- f1v-commons-gcp-memorystore-redis  # Redis template + Pub/Sub listener container
+-- f1v-commons-api-openf1             # OpenF1 WebClient, auth token lifecycle
```

Each microservice picks only the modules it needs — for example, `f1v-service-telemetry` pulls in `commons-service-websocket` and `commons-gcp-memorystore-redis` but has no dependency on BigQuery or Firestore.

### Key Backend Patterns

- **Scoped Maven Builds** — Each CI pipeline compiles only the target module and its transitive commons dependencies (`mvn -pl <module> -am`), avoiding a full monorepo rebuild on every change.
- **Spring Boot Layered JARs** — Production images use `java -Djarmode=layertools -jar ... extract` to split the fat JAR into four Docker layers (dependencies, loader, snapshots, application), maximizing cache reuse since dependency layers rarely change.
- **Stateless JWT Validation** — All services validate JWTs locally using the Auth0 JWKS endpoint. No session state exists anywhere in the backend — every request carries its own authentication context.
- **STOMP Channel Interceptor** — WebSocket connections are authenticated at the STOMP protocol level. The interceptor extracts the JWT from the CONNECT frame's Authorization header, validates it, and sets the security principal before any message routing occurs.
- **Scheduled Token Refresh** — The OpenF1 API client automatically refreshes its access token on a fixed schedule via `@Scheduled`, maintaining an always-valid credential without request-time auth overhead.
- **Windowed Replay Engine** — The Ingestion Service's replay engine processes historical sessions in 60-second chunks with async prefetching at 50% chunk progress, preventing OOM on multi-hour sessions. A single-threaded `ChunkLoader` executor serializes BigQuery queries to avoid overwhelming the data warehouse. Play, pause, and seek operations are exposed via REST endpoints and broadcast progress via Redis.
- **Reference Data Caching** — The Analysis Service caches driver, session, and circuit reference data from Firestore in memory, avoiding repeated document reads for data that changes only between seasons.
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

The infrastructure is fully codified across 12 reusable OpenTofu modules, composed per environment via Terragrunt:

```
infrastructure/modules/
|
+-- iam-and-secrets      6 service accounts with principle-of-least-privilege bindings
|       |
+-- networking           VPC, subnet, firewall rules, serverless VPC connector
|       |
+-- artifact-registry    Docker image repository
+-- firestore            Document database (delete protection per env)
+-- bigquery             Dataset + 7 tables (partitioned + clustered)
+-- redis                Memorystore (BASIC for dev, STANDARD_HA for prod)
|       |
+-- cloud-run (x5)       Frontend + 4 backend services (VPC connector for Redis access)
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

- **CORS at Load Balancer Edge** — The API load balancer's URL map includes a `cors_policy` that handles OPTIONS preflight requests at the edge with a 204 response, preventing cascade failures when the API Gateway is cold-starting or rate-limiting. REST and WebSocket backends receive separate CORS header configurations.

- **Always-Warm Services** — All backend Cloud Run services set `min_instance_count = 1` to eliminate cold-start delays. This is critical because the splash screen prefetches reference data immediately after login, `/users/me` is called on every authentication, and WebSocket connections benefit from instant availability.

- **Bootstrap API Gateway** — Terraform creates a minimal health-check endpoint in the API Gateway config, then uses `ignore_changes = [api_config]` to prevent Terragrunt from reverting the active config. Cloud Build manages the real routing spec with dynamically-discovered Cloud Run service URLs and Auth0 configuration.

- **Scoped IAM** — Each microservice runs under a dedicated service account with only the permissions it requires:
  - Analysis: BigQuery read + job execution + Firestore read (reference data cache)
  - Ingestion: BigQuery write + Secret Manager read (OpenF1 credentials)
  - Telemetry: Redis subscribe only
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
GitHub Actions (3 parallel jobs)            Cloud Build (7 path-filtered triggers)
    |                                             |
    +-- Backend: mvn clean package                +-- backend-data-analysis.yaml
    +-- Frontend: yarn lint + test                +-- backend-data-ingestion.yaml
    +-- Infra: tfsec + tofu validate              +-- backend-telemetry.yaml
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

The frontend pipeline extends this with lint and test gates:

```
1. Install Dependencies     yarn install (Node 25 Alpine + native canvas deps)
         |
2. ESLint Check             yarn lint
         |
3. Unit + Visual Tests      yarn test:ci (Vitest + jest-image-snapshot)
         |
4. Production Build         yarn build --mode ${_ENV}
         |
5. Kaniko Image Build       Layer-cached Docker build -> Artifact Registry
         |
6. Cloud Run Deploy         gcloud run services update --image=<sha-tagged>
```

The infrastructure pipeline uses a scan-plan-apply pattern:

```
1. Install Tools            OpenTofu 1.9.0 + Terragrunt 0.77.0
         |
2. tfsec Security Scan      tfsec --minimum-severity HIGH
         |
3. Terragrunt Init          terragrunt run-all init
         |
4. Terragrunt Plan          terragrunt run-all plan
         |
5. Terragrunt Apply         terragrunt run-all apply -auto-approve
```

### Key CI/CD Patterns

- **Path-Filtered Triggers** — Each trigger specifies `included_files` globs scoped to the relevant service directory plus its shared commons dependencies. A change to only the User Service will trigger only `backend-user.yaml` — not the other three backend pipelines. This eliminates redundant builds entirely.

- **Immutable Image Tags** — Every image is tagged with the git commit SHA (`${SHORT_SHA}`) in addition to `latest`. Cloud Run deployments reference the SHA tag, ensuring every deployment is traceable to an exact commit.

- **Lean CI Dockerfiles** — Separate `Dockerfile.ci` files accept pre-built artifacts (extracted JAR layers for backend, `dist/` for frontend) from earlier Cloud Build steps, eliminating the double-compilation that would occur with a standard multi-stage Dockerfile.

- **Layer-Cached Builds** — Kaniko's `--cache=true` with per-service `--cache-repo` repositories ensures that unchanged Docker layers are reused across builds, dramatically reducing build times for dependency-stable services.

- **Pre-Image Security Scanning** — Trivy scans the extracted JAR filesystem before the Docker image is built. This fails fast on vulnerabilities without wasting time building an image that would be rejected.

- **API Gateway Smoke Test** — After deploying a new API Gateway configuration, the pipeline waits 30 seconds for propagation and then hits the `/api/v1/analysis/drivers` endpoint, failing the build if the gateway returns a 404 or server error.

---

## Testing

The project maintains a comprehensive multi-layered testing strategy spanning unit, integration, component, visual regression, and security testing across all three pillars of the monorepo.

### Backend Test Suite

**Framework:** JUnit 5 (Jupiter 6.0.3) with Mockito, Spring Boot Test 4.0.3

All backend test dependencies are centrally managed through the `f1v-commons-bom`, ensuring consistent versions across all four microservices. Each service has its own `src/test/java/` and `src/test/resources/` trees with environment-specific test profiles.

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
cd backend && mvn clean package

# Scoped test run (single service + its commons dependencies)
cd backend && mvn clean package -pl f1v-service-data-analysis -am
```

### Frontend Test Suite

**Framework:** Vitest 4.0.18 with React Testing Library, jsdom, jest-image-snapshot

**Configuration:** `vitest.config.ts` — jsdom environment, global test APIs enabled, `@` path alias, and a setup file (`src/test/setup.ts`) that polyfills `ResizeObserver`, `requestAnimationFrame`/`cancelAnimationFrame`, and configures automatic React Testing Library cleanup between tests.

| Category | Framework / Tool | Description |
|----------|-----------------|-------------|
| **Component Tests** | React Testing Library | Renders React components with `render()` and asserts on DOM output, user interactions (`fireEvent`), and async state updates (`waitFor`, `act`). Covers 15 components including `CircuitTrace`, `LapTimeChart`, `RadarChart`, `RaceSimulator`, `SessionControlPanel`, and `VersusMode`. |
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
| **Security Scanning** | tfsec | Static analysis of all 11 OpenTofu modules against security best practices. Enforces a minimum severity threshold of `HIGH` — any violation fails the pipeline. Runs on both PR checks (GitHub Actions) and deployment pipelines (Cloud Build). |
| **Module Validation** | OpenTofu `validate` | Syntax and semantic validation of each Terraform module individually (`tofu init -backend=false && tofu validate`). Catches HCL errors, missing variables, and invalid resource references before any plan or apply. |
| **Deployment Planning** | Terragrunt `plan` | Generates an execution plan showing all proposed infrastructure changes before applying, serving as a safety gate in the Cloud Build pipeline. |
| **API Contract Validation** | OpenAPI 2.0 Spec | The `openapi.yaml` specification defines the full API contract (paths, methods, request/response schemas, Auth0 security scheme). The API Gateway pipeline validates the spec and runs a smoke test against the deployed gateway's `/health` endpoint. |
| **Container Scanning** | Trivy | Filesystem-level vulnerability scanning of all backend service JARs before Docker image construction. Configured with `--exit-code 1 --severity CRITICAL,HIGH` — any critical or high-severity CVE fails the build immediately. |

### Test Distribution Summary

| Layer | Test Files | Test Framework | Test Types |
|-------|-----------|---------------|------------|
| **Backend** | 25 files, 105+ test methods | JUnit 5, Mockito, Spring Boot Test | Unit, controller, security, reactive, serialization, parameterized |
| **Frontend** | 23 files | Vitest, React Testing Library | Component, visual regression, hook, utility, API client, auth |
| **Infrastructure** | — | tfsec, OpenTofu, Trivy | Security scanning, module validation, container scanning |

### CI Test Integration

Tests execute at two stages in the delivery pipeline:

1. **PR Quality Gate (GitHub Actions)** — Three parallel jobs run on every pull request to `main`:
   - Backend: `mvn clean package -am` (compiles and tests all modules)
   - Frontend: `yarn lint` then `yarn test:ci` (ESLint + Vitest)
   - Infrastructure: tfsec scan + `tofu validate` per module

2. **Deployment Pipeline (Cloud Build)** — Tests re-run as part of each service's build-scan-deploy pipeline on environment branches (`dev`, `uat`, `prod`). The frontend pipeline additionally installs native C++ dependencies (Cairo, Pango, Python, g++) on Alpine Linux to support the `canvas` package required by the visual regression test suite.

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
| **CORS** | Multi-Layer | LB edge handles OPTIONS preflight; Spring CORS on REST; custom headers on WebSocket |

---

## Environment Configuration

Three parallel environments share identical module code but diverge on scale, region, and security posture:

| Dimension | Dev | UAT | Prod |
|-----------|-----|-----|------|
| **Region** | us-central1 | us-east1 | us-central1 |
| **Branch Trigger** | `^dev$` | `^uat$` | `^prod$` |
| **API Domain** | dev.api.f1visualizer.com | uat.api.f1visualizer.com | api.f1visualizer.com |
| **Frontend Domain** | dev.f1visualizer.com | uat.f1visualizer.com | f1visualizer.com |
| **Auth0 Tenant** | elysianarts-dev | elysianarts-uat | elysianarts |
| **Firestore DB** | f1v-db-dev | f1v-db-uat | f1v-db-prod |
| **Redis Tier** | BASIC (single node) | BASIC (single node) | STANDARD_HA (automatic failover) |
| **Firestore Delete Protection** | Disabled | Disabled | Enabled |
| **VPC Connector CIDR** | 10.8.0.0/28 | 10.8.0.16/28 | 10.8.0.32/28 |
| **Cloud Run Min Instances** | 1 (warm) | 1 (warm) | 1 (warm) |

All environments share a single GCP project (`f1-visualizer-488201`), a single Artifact Registry repository (`f1v-repo`), and a shared BigQuery dataset (`f1_dataset`) — differentiated by environment labels and image tags.

---

## Disclaimer

*F1 Visualizer is an unofficial, open-source personal project and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.*
