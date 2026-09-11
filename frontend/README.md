# F1 Visualizer — Web Client

The React single-page application for F1 Visualizer. It renders live and replayed Formula 1
telemetry: a 60fps HTML5 Canvas circuit trace driven by a STOMP WebSocket feed, D3-backed lap
time and driver comparison charts, and a session browser over historical race data.

This is one of three pillars in the monorepo. For system architecture, the backend services and
the infrastructure, see the [root README](../README.md).

---

## Stack

| Concern             | Choice                                   | Version     |
| ------------------- | ---------------------------------------- | ----------- |
| UI framework        | React, compiled by the React Compiler    | 19.3        |
| Language            | TypeScript                               | 6.0         |
| Build tooling       | Vite (Rolldown)                          | 8.3         |
| Routing             | React Router                             | 7.18        |
| Server state        | TanStack Query                           | 5.102       |
| Validation          | Zod, on every data-bearing response      | 4.6         |
| Component library   | Material UI + Emotion                    | 9.4 / 11.14 |
| Animation           | Framer Motion                            | 13.2        |
| Charting            | D3.js                                    | 7.9         |
| Real-time transport | `@stomp/stompjs` over a native WebSocket | 7.3         |
| HTTP                | Axios                                    | 1.20        |
| Auth                | Auth0 React SDK (OAuth2 + PKCE)          | 2.24        |
| Unit tests          | Vitest + React Testing Library + jsdom   | 5.0 / 30    |
| End-to-end tests    | Playwright + axe                         | 1.63        |

TypeScript 7 is released; 6.0 is the newest release `typescript-eslint` accepts (`<6.1`), so the
pin is `~6.0`. Node 26 and Yarn 1.x (classic). The CI image and the production `Dockerfile` both
build on `node:26-alpine`, pinned by digest.

---

## Getting started

```bash
yarn install
yarn dev
```

The dev server listens on `http://localhost:5173` with hot module replacement.

`yarn dev` expects the backend services to be running locally. Vite proxies API and WebSocket
traffic to them, so no CORS configuration or base-URL override is needed in development:

| Path prefix         | Proxied to       | Service                                                |
| ------------------- | ---------------- | ------------------------------------------------------ |
| `/api/v1/ingestion` | `localhost:8081` | Ingestion — live/simulation commands, playback control |
| `/api/v1/analysis`  | `localhost:8082` | Analysis — laps, driver stats, session catalog         |
| `/api/v1/users`     | `localhost:8083` | User — profiles and preferences                        |
| `/ws`               | `localhost:8080` | Telemetry — STOMP over WebSocket (upgrade enabled)     |

Any route the app calls that isn't listed above is served by Vite itself, so a 404 from the dev
server usually means a missing proxy entry rather than a backend fault. The replay worker has no
HTTP API to proxy; it is driven through the ingestion endpoints.

---

## Environment modes

Auth0 credentials and the deployed API base URL come from Vite env files, one per environment:
`.env.dev`, `.env.uat`, `.env.prod`, plus `.env.e2e` for the Playwright run (a stubbed tenant on a
reserved `.test` domain, so a stub that stops matching fails on DNS rather than reaching a real
tenant). Each defines:

```
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_AUTH0_AUDIENCE
VITE_API_BASE_URL
```

Select one at build time with Vite's `--mode` flag. The Cloud Build pipeline passes the target
environment through the same flag, so a production bundle is produced by:

```bash
yarn build --mode prod
```

`VITE_API_BASE_URL` is only consulted in built bundles; during `yarn dev` the proxy table above
takes over instead. The WebSocket URL is derived from the same origin (`wss://<api host>/ws/websocket`),
so there is no separate setting for it.

---

## Scripts

| Script               | Does                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| `yarn dev`           | Vite dev server on port 5173 with HMR                                          |
| `yarn build`         | `tsc -b` project-references typecheck, then a Vite production build to `dist/` |
| `yarn preview`       | Serve a built `dist/` locally to sanity-check a production bundle              |
| `yarn typecheck`     | `tsc -b` alone                                                                 |
| `yarn lint`          | ESLint across the project (flat config, `eslint.config.js`), zero warnings     |
| `yarn format`        | Prettier, writing; `yarn format:check` is the read-only form CI runs           |
| `yarn test:ci`       | Vitest single-pass run, no watch                                               |
| `yarn test:coverage` | The same run with V8 coverage and the thresholds applied — what the PR runs    |
| `yarn test:e2e`      | Playwright: builds with `--mode e2e`, serves it, runs both viewport projects   |
| `yarn test:e2e:ui`   | The same suite in Playwright's UI mode                                         |
| `yarn size`          | size-limit against the gzipped bundle budgets in `.size-limit.js`              |

For a watch-mode test loop during development, run `yarn vitest` directly.

Note that `yarn build` typechecks before bundling, so it is the fastest way to catch a type error
across the whole project — `yarn dev` will happily run code that does not typecheck.

The PR check runs, in order: `yarn audit --level high`, `format:check`, `lint`, `typecheck`,
`test:coverage`, `build --mode dev`, `size`, and then the e2e suite in its own job.

---

## Layout

```
src/
+-- api/                  REST clients, the query layer and the STOMP connection
|   +-- apiClient.ts        Axios instance: JWT interceptor, jittered idempotent-only retry
|   +-- queries.ts          TanStack Query definitions, shared by components and the prefetch
|   +-- queryClient.ts      The one QueryClient (module singleton, so the splash can warm it)
|   +-- prefetch.ts         Splash-time cache warming, imported dynamically
|   +-- schemas.ts          Zod schemas for every data-bearing response
|   +-- parseResponse.ts    parseResponse / parseBatch: validate, or fail loudly at the boundary
|   +-- mappers.ts          Wire shape -> UI types
|   +-- referenceApi.ts     Drivers, sessions, seasons, rosters, driver stats, laps
|   +-- ingestionApi.ts     Start live/simulation, playback control
|   +-- userApi.ts          Profile and preferences
|   +-- stompClient.ts      STOMP over a native WebSocket, JWT in the CONNECT frame
+-- app/AppDataProvider.tsx   QueryClientProvider and the user context, together
+-- auth/                 Auth0 wiring
|   +-- AuthHandler.tsx       Injects the bearer token into Axios requests
|   +-- StompAuthHandler.tsx  Supplies the token to the STOMP CONNECT frame
+-- components/
|   +-- RaceSimulator.tsx           Live console shell: telemetry panels + trace
|   +-- CircuitTrace.tsx            Canvas track render, 60fps
|   +-- CircuitTraceLoadingOverlay.tsx / CircuitTraceIdleOverlay.tsx
|   +-- LapTimeChart.tsx            D3 SVG multi-driver lap times
|   +-- MediaController.tsx         Play / pause / seek for replay
|   +-- DataVaultLoader.tsx, HeadToHeadLoader.tsx
|   +-- ErrorBoundary.tsx           Auto-retry boundary
|   +-- AuthErrorScreen.tsx, ConfigErrorScreen.tsx
|   +-- layout/                     App shell, user settings modal
|   +-- selectors/                  Driver and session/season pickers
|   +-- splash/                     Post-login cinematic sequence, prefetch sequencing, skip preference
|   +-- ui/                         Empty and error states, route fallback, shimmer, cycling label
|   +-- versus/                     Radar chart, animated stat bars
+-- config/env.ts         API base URL and the WebSocket URL derived from it
+-- context/UserContext.tsx   Profile and preferences, app-wide
+-- features/live/        Live telemetry panel, lap correlation, the race-session hook
+-- hooks/
|   +-- useTelemetry.ts       STOMP subscription, latest frame per driver, flushed on rAF
|   +-- useLocation.ts        STOMP subscription, every GPS point forwarded directly
+-- lib/                  Logger, error reporting, perf marks, web-vitals, build info
+-- pages/                Route-level screens
+-- realtime/             Connection-status store and hook (connecting / reconnecting / open)
+-- theme/                MUI theme, design tokens, motion variants
+-- types/                Shared telemetry and user types
+-- utils/                Pure helpers — chart scales, circuit projection, radar geometry
+-- test/                 Vitest setup and matcher augmentations
e2e/                      Playwright specs and the Auth0 / API / WebSocket fixtures
```

`@` is aliased to `src/`, in both `vite.config.ts` and `tsconfig.app.json`, so
`import { fetchDrivers } from '@/api/referenceApi'` resolves from anywhere.

---

## Routes

| Path          | Screen                                     | Access        |
| ------------- | ------------------------------------------ | ------------- |
| `/`           | Landing — public login page                | Public        |
| `/dashboard`  | Live Console (`RaceSimulator`)             | Authenticated |
| `/historical` | Data Vault — session search and lap charts | Authenticated |
| `/versus`     | Head-to-Head — radar and stat comparison   | Authenticated |

Authenticated routes are nested inside a `RequiredAuth` guard and the `LayoutMain` shell, so the
navigation chrome renders once and survives route transitions. Each page is a lazy chunk behind a
`Suspense` fallback; the splash prefetches the chunks along with the reference data, so the first
transition to each page is already warm.

---

## How data reaches the screen

Two paths, deliberately separate:

**Request/response** — Axios via `apiClient.ts`, which attaches the Auth0 bearer token, retries
transient failures (429, 502–504, network, the 15 s timeout) up to three times with jittered
exponential backoff — idempotent requests only — and honours `Retry-After`. Responses are parsed
against a Zod schema before they reach a component. Caching, de-duplication and staleness are
TanStack Query's job (`queries.ts`): several components ask for the driver list on mount, and
StrictMode doubles each call, so without de-duplication a page load fired six to eight concurrent
requests and tripped the edge rate limiter. Used for reference data, session catalogs, historical
laps and user preferences.

**Streaming** — a STOMP client over a native WebSocket to `/ws/websocket`, authenticated at the
protocol level: the JWT travels in the CONNECT frame rather than a query parameter, and is re-read
on every reconnect. Backoff is the library's exponential mode (5 s doubling to a 60 s cap) with a
circuit breaker after six consecutive failures; heartbeats run on a Worker ticker so a hidden tab's
`setInterval` throttling cannot tear down a healthy socket.

The two subscription hooks buffer differently on purpose. `useTelemetry` collects inbound frames
and, on each animation frame, emits only the most recent one per driver — the readouts show a
current value, so intermediate frames are discarded and a burst of messages costs one render
instead of dozens. `useLocation` pushes every point straight through with no rAF buffer, because
the circuit trace draws the whole path and a dropped coordinate is a gap in the line.

The Canvas trace is driven directly from the buffered telemetry rather than through React state
per frame — React owns the surrounding UI, and the render loop owns the pixels.

---

## Testing

```bash
yarn test:ci
```

54 test files, 352 tests. The suite covers components with React Testing Library, custom hooks
via `renderHook`, pure utilities, the Axios and STOMP clients, and the Auth0 interceptors.
`yarn test:coverage` runs the same suite instrumented and fails below 89% statements, 76% branches,
77% functions and 89% lines — the thresholds in `vite.config.ts`, which the PR check enforces.

**Visual regression.** `CircuitTrace` is rendered to a Node canvas via `node-canvas` and compared
against five stored PNG baselines in `src/components/__tests__/__image_snapshots__/`, using
`jest-image-snapshot` with a 0.01% pixel-difference threshold. This is why `canvas` is a
dependency and why the CI image installs Cairo, Pango and a C++ toolchain — the addon is compiled
natively rather than shipped prebuilt.

If a baseline needs to change because the rendering intentionally changed, delete the affected
PNG and re-run the suite to regenerate it. Review the regenerated image before committing; an
accidentally accepted baseline silently disables the check.

**End-to-end.** `yarn test:e2e` builds the bundle with `--mode e2e`, serves it on
`127.0.0.1:4173`, and runs twelve Playwright tests on a desktop Chrome project and a Pixel 7
project: the real Auth0 redirect handshake against the stubbed tenant, the SPA fallback for a
deep link, a live circuit trace fed by mocked STOMP frames through `routeWebSocket`, canvas
re-scaling on a viewport change, and axe accessibility scans of the landing page and the
authenticated shell. It is the only layer that exercises the redirect, real STOMP frames and a
real canvas resize.

**Bundle budget.** `yarn size` measures the gzipped first load of the public landing route
(250 kB) and the total across all chunks (415 kB). Each raise of a limit is recorded in
`.size-limit.js` with the measurement behind it.

---

## Production build

`Dockerfile` builds the bundle on `node:26-alpine` and serves `dist/` from
`nginxinc/nginx-unprivileged` on port 8080, with `nginx.conf` providing SPA history fallback,
`/healthz`, immutable caching for hashed assets, `no-cache` for `index.html`, gzip, and security
headers (CSP, HSTS, COOP/CORP, `X-Frame-Options`, a Permissions-Policy). `Dockerfile.ci` is the
counterpart used by Cloud Build: it skips the build stage and copies in a `dist/` produced by an
earlier pipeline step, so the bundle is compiled exactly once per pipeline run. The pipeline then
scans the image, deploys it with no traffic, smoke-tests the tagged revision — including the
`<meta name="version">` stamp for this exact commit — and only then promotes it.
