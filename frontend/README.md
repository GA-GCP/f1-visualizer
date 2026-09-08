# F1 Visualizer — Web Client

The React single-page application for F1 Visualizer. It renders live and replayed Formula 1
telemetry: a 60fps HTML5 Canvas circuit trace driven by a STOMP WebSocket feed, D3-backed lap
time and driver comparison charts, and a session browser over historical race data.

This is one of three pillars in the monorepo. For system architecture, the backend services and
the infrastructure, see the [root README](../README.md).

---

## Stack

| Concern | Choice | Version |
|---|---|---|
| UI framework | React | 19.2 |
| Language | TypeScript | 6.0 |
| Build tooling | Vite | 8.2 |
| Component library | Material UI + Emotion | 9.4 / 11.14 |
| Animation | Framer Motion | 13.2 |
| Charting | D3.js | 7.9 |
| Real-time transport | `@stomp/stompjs` over SockJS | 7.3 |
| HTTP | Axios | 1.20 |
| Auth | Auth0 React SDK (OAuth2 + PKCE) | 2.24 |
| Tests | Vitest + React Testing Library + jsdom | 5.0 |

Node 26 and Yarn 1.x (classic). The CI image and the production `Dockerfile` both build on
`node:26-alpine`.

---

## Getting started

```bash
yarn install
yarn dev
```

The dev server listens on `http://localhost:5173` with hot module replacement.

`yarn dev` expects the backend services to be running locally. Vite proxies API and WebSocket
traffic to them, so no CORS configuration or base-URL override is needed in development:

| Path prefix | Proxied to | Service |
|---|---|---|
| `/api/v1/ingestion` | `localhost:8081` | Ingestion — live/simulation commands, playback control |
| `/api/v1/analysis` | `localhost:8082` | Analysis — laps, driver stats, session catalog |
| `/api/v1/users` | `localhost:8083` | User — profiles and preferences |
| `/ws` | `localhost:8080` | Telemetry — STOMP over WebSocket (upgrade enabled) |

Any route the app calls that isn't listed above is served by Vite itself, so a 404 from the dev
server usually means a missing proxy entry rather than a backend fault.

---

## Environment modes

Auth0 credentials and the deployed API base URL come from Vite env files, one per environment:
`.env.dev`, `.env.uat`, `.env.prod`. Each defines:

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
takes over instead.

---

## Scripts

| Script | Does |
|---|---|
| `yarn dev` | Vite dev server on port 5173 with HMR |
| `yarn build` | `tsc -b` project-references typecheck, then a Vite production build to `dist/` |
| `yarn preview` | Serve a built `dist/` locally to sanity-check a production bundle |
| `yarn lint` | ESLint across the project (flat config, `eslint.config.js`) |
| `yarn test:ci` | Vitest single-pass run, no watch — what CI executes |

For a watch-mode test loop during development, run `yarn vitest` directly.

Note that `yarn build` typechecks before bundling, so it is the fastest way to catch a type error
across the whole project — `yarn dev` will happily run code that does not typecheck.

---

## Layout

```
src/
+-- api/                  REST clients and the STOMP connection
|   +-- apiClient.ts        Axios instance: JWT interceptor, retry, 429 backoff
|   +-- referenceApi.ts     Drivers, sessions, seasons, driver stats
|   +-- ingestionApi.ts     Start/stop simulation, playback control
|   +-- userApi.ts          Profile and preferences
|   +-- stompClient.ts      STOMP-over-SockJS client with JWT CONNECT auth
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
|   +-- layout/                     App shell, user settings modal
|   +-- selectors/                  Driver and session/season pickers
|   +-- splash/                     Post-login cinematic sequence
|   +-- versus/                     Radar chart, animated stat bars
+-- context/UserContext.tsx   Profile and preferences, app-wide
+-- hooks/
|   +-- useTelemetry.ts       STOMP subscription, buffered to a 60fps flush
|   +-- useLocation.ts        STOMP subscription retaining every GPS point
+-- pages/                Route-level screens
+-- types/                Shared telemetry and user types
+-- utils/                Pure helpers — chart scales, circuit projection, radar geometry
+-- test/                 Vitest setup and matcher augmentations
```

`@` is aliased to `src/`, in both `vite.config.ts` and `tsconfig.app.json`, so
`import { fetchDrivers } from '@/api/referenceApi'` resolves from anywhere.

---

## Routes

| Path | Screen | Access |
|---|---|---|
| `/` | Landing — public login page | Public |
| `/dashboard` | Live Console (`RaceSimulator`) | Authenticated |
| `/historical` | Data Vault — session search and lap charts | Authenticated |
| `/versus` | Head-to-Head — radar and stat comparison | Authenticated |

Authenticated routes are nested inside a `RequiredAuth` guard and the `LayoutMain` shell, so the
navigation chrome renders once and survives route transitions.

---

## How data reaches the screen

Two paths, deliberately separate:

**Request/response** — Axios via `apiClient.ts`, which attaches the Auth0 bearer token, retries
idempotent failures and backs off on 429. Used for reference data, session catalogs, historical
laps and user preferences.

**Streaming** — a STOMP client over SockJS, authenticated at the protocol level: the JWT travels
in the CONNECT frame rather than a query parameter.

The two subscription hooks buffer differently on purpose. `useTelemetry` collects inbound frames
and, on each animation frame, emits only the most recent one — the readouts show a current value,
so intermediate frames are discarded and a burst of messages costs one render instead of dozens.
`useLocation` pushes every point straight through with no rAF buffer, because the circuit trace
draws the whole path and a dropped coordinate is a gap in the line.

The Canvas trace is driven directly from the buffered telemetry rather than through React state
per frame — React owns the surrounding UI, and the render loop owns the pixels.

---

## Testing

```bash
yarn test:ci
```

38 test files, 188 tests. The suite covers components with React Testing Library, custom hooks
via `renderHook`, pure utilities, the Axios and STOMP clients, and the Auth0 interceptors.

**Visual regression.** `CircuitTrace` is rendered to a Node canvas via `node-canvas` and compared
against five stored PNG baselines in `src/components/__tests__/__image_snapshots__/`, using
`jest-image-snapshot` with a 0.01% pixel-difference threshold. This is why `canvas` is a
dependency and why the CI image installs Cairo, Pango and a C++ toolchain — the addon is compiled
natively rather than shipped prebuilt.

If a baseline needs to change because the rendering intentionally changed, delete the affected
PNG and re-run the suite to regenerate it. Review the regenerated image before committing; an
accidentally accepted baseline silently disables the check.

---

## Production build

`Dockerfile` builds the bundle on `node:26-alpine` and serves `dist/` from
`nginxinc/nginx-unprivileged` on port 8080, with `nginx.conf` providing SPA history fallback and
security headers. `Dockerfile.ci` is the counterpart used by Cloud Build: it skips the build stage
and copies in a `dist/` produced by an earlier pipeline step, so the bundle is compiled exactly
once per pipeline run.
