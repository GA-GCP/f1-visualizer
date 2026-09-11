# F1 Visualizer · Frontend Audit (2026-09-06)

> Repository: GA-GCP/f1-visualizer (monorepo) · Scope: `frontend/` · Audited at `main @ c3f2563` · Read-only audit, no source changes.
> 96 findings, ids F001–F096: 3 critical · 23 high · 44 medium · 26 low.

## 0. Conventions

- Conventions: Severity = Critical / High / Medium / Low. Category = S1 Performance · S2 Fluidity · S3 Enterprise (the three audit goals). Effort = S (under half a day) · M (1–3 days) · L (over 3 days). Priority = 1–10 (impact × confidence ÷ effort).
- Every finding was checked against the source at c3f2563 and, where a library claim mattered, against `node_modules`. Line numbers drift after edits; the **Evidence** snippet in each finding is the durable locator.

## 1. Context snapshot

### 1.1 Stack (installed versions)

- React 19.2.8 · react-dom 19.2.8 · react-router-dom 7.18.3 · TypeScript 6.0.3 · Vite 8.2.2 (rolldown-based) · @vitejs/plugin-react 6.1.1
- MUI 9.4.0 (@mui/material, @mui/icons-material) + Emotion 11.14 · framer-motion 13.2.0 (motion-dom 13.2) · d3 7.9 (full package import, tree-shakes cleanly) · axios 1.20
- @stomp/stompjs 7.3.0 over sockjs-client 1.6.1 · @auth0/auth0-react 2.24.1 (auth0-spa-js 2.24) · date-fns 4.4 (declared, never imported)
- Dev: Vitest 5.0 + jsdom 30 + RTL 16 · jest-image-snapshot + node `canvas` (visual regression) · ESLint 10 flat config (js recommended + tseslint recommended + react-hooks 7 + react-refresh only) · Node 26.8 · Yarn 1.22 classic
- Deploy: nginxinc/nginx-unprivileged:alpine on Cloud Run (port 8080, 1 CPU / 512 Mi, cpu_idle, startup boost) behind a global external managed LB (no Cloud CDN, no compression_mode). CI: GitHub PR checks run `yarn lint` + `yarn test:ci` only; Cloud Build runs install / lint / test / build / docker / deploy.

### 1.2 Layout

```
frontend/src/
  App.tsx                      theme (inline createTheme), Auth0ProviderWithNavigate, RequiredAuth (post-login splash + prefetch), LandingGate, routes
  main.tsx                     createRoot + StrictMode
  api/apiClient.ts             axios instance: 429 + ERR_NETWORK retry interceptor (no timeout, no cancellation)
  api/referenceApi.ts          drivers/sessions/years/roster/laps + module-level caches with in-flight dedup and 3 s failure cooldown
  api/ingestionApi.ts, userApi.ts
  api/stompClient.ts           @stomp/stompjs Client over SockJS, hand-rolled backoff (inert), debug -> console.log, activateWithToken
  auth/AuthHandler.tsx         AxiosAuthInterceptor (getAccessTokenSilently per request)
  auth/StompAuthHandler.tsx    fetches token, waits 2 s, activates STOMP; deactivates on unmount
  hooks/useTelemetry.ts        polls stompClient.connected every 500 ms, buffers /topic/race-data, rAF flush of the LAST packet only
  hooks/useLocation.ts         polls every 500 ms, pushes every /topic/race-location packet into a ref queue
  components/RaceSimulator.tsx 375 LOC dashboard root: 13 useState, lap correlation per packet, owns all tick state
  components/CircuitTrace.tsx  canvas rAF loop: drains queue, unbounded history, full redraw per frame, no DPR scaling
  components/LapTimeChart.tsx, versus/RadarChart.tsx (imperative d3), versus/StatComparisonBar.tsx (width tweens)
  components/layout/LayoutMain.tsx (AppBar, AnimatePresence mode="wait" around <Outlet/>), layout/UserSettingsModal.tsx
  components/splash/*          7 s post-login sequence; SplashBackground + SplashCircuit reused by pages/Landing.tsx
  components/*Loader.tsx       HeadToHeadLoader (610 LOC), DataVaultLoader (328 LOC) skeletons
  pages/Landing.tsx, Home.tsx, HistoricalData.tsx, VersusMode.tsx
  utils/circuitProjection.ts, radarGeometry.ts, chartScales.ts (tested; the first two are unused by components)
  context/UserContext.tsx      profile + preferences (value object recreated each render)
  types/telemetry.ts, user.ts
frontend/index.html            Google Fonts link (render-blocking), no meta description/theme-color/background
frontend/nginx.conf            strict per-host CSP, HSTS, Permissions-Policy, expires max on hashed assets; NO gzip, NO Cache-Control on index.html, NO health endpoint
frontend/vite.config.ts        react(), @ alias via __dirname, define global=window (for SockJS), no build block
frontend/vitest.config.ts      duplicates plugin/alias; jsdom; globals true
.github/workflows/pr-checks.yml, cloudbuild/frontend.yaml, infrastructure/modules/{lb-frontend,cloud-run-frontend}
```

### 1.3 Data paths

- REST: axios via `apiClient.ts` (JWT attached by an interceptor registered in `AuthHandler.tsx`); reference data cached at module level in `referenceApi.ts`; prefetched during the splash with a 400 ms stagger to avoid API-gateway 429s.
- Streaming: STOMP over SockJS; JWT in the CONNECT frame; `/topic/race-data` (all drivers, coalesced to one packet per frame) and `/topic/race-location` (every point, pushed to a mutable queue drained by the canvas loop). Heartbeats 10 s both ways, matching the broker.

### 1.4 Baselines measured on this checkout

| Check | Result |
|---|---|
| `yarn build --mode prod` | 1 chunk `dist/assets/index-*.js`: 1,146.9 kB minified / 358.4 kB gzip; index.html 0.54 kB; no CSS file (Emotion runtime); Vite warns chunk > 500 kB and `__dirname` in config |
| Bundle composition (pre-minify source bytes, 3.66 MB) | @mui/material 23.0% · react-dom 14.9% · react-router 10.3% · motion-dom + framer-motion 13.8% · @auth0/auth0-react 6.7% · axios 4.6% · @mui/system+utils 5.7% · sockjs + stompjs 5.2% · d3 ≈ 4% (55.5 kB min / 19 kB gz after tree-shaking) · app code ≈ 6% |
| `yarn lint` | clean |
| `yarn test:ci` | 38 files / 188 tests pass in 6.7 s; jsdom created 38× (36% of wall time); 6 "Not implemented: scrollTo" warnings |
| `yarn audit` | 0 vulnerabilities / 569 packages; `yarn outdated`: typescript 6.0.3 → 7.0.2 available |
| Untested source files | 5 of 41: App.tsx (253 LOC), UserSettingsModal.tsx, main.tsx, two type files |
| Lockfile duplicates (runtime) | react-is ×4 versions, @babel/runtime ×2 |
| Code signals (src, excl. tests) | 41 console.* calls · 0 `any` · 13 non-null `!` · 0 dangerouslySetInnerHTML · 1 reduced-motion reference · 2 aria-* attrs · 2 useMemo · 3 useCallback · 0 memo() · 0 AbortController · 0 lazy()/Suspense · 32 setTimeout/setInterval · 14 requestAnimationFrame · 144 hard-coded hex colours (39 distinct) |
| Landing page (prod build served locally) | first contentful paint 3.6 s although the script was ready at 65 ms (blank until Auth0 resolves; the sandbox blocked the Auth0 host so the absolute number is inflated) · 13 spans keep `will-change: transform, opacity, filter` + `filter: blur(0px)` for the page lifetime · 2 infinite animations + SVG orbit · 5 font faces requested (300 and 600 unused; 700-italic and 900 used but not requested) · 375 px: no horizontal overflow, CTA wraps to 2 lines |
| Post-login splash | fixed 7,000 ms timeline + 500 ms hold, not skippable, `<Outlet/>` mounts only after it |

### 1.5 Library facts verified in node_modules (do not re-derive)

- **@stomp/stompjs 7.3.0**: `_schedule_reconnect()` uses the private `_nextReconnectDelay`, assigned from `reconnectDelay` only in `activate()` and in the internal onConnect handler. Mutating `client.reconnectDelay` inside `onWebSocketClose` has no effect (F002). Built-ins: `reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL`, `maxReconnectDelay`, `beforeConnect(client)` (async, runs before every CONNECT), `heartbeatStrategy: TickerStrategy.Worker`, `deactivate()` to stop reconnecting. `debug()` receives `>>> <serialised frame>` for every outgoing frame (CONNECT includes the Authorization header) and `<<< …` for every inbound chunk.
- **@mui/material 9.4.0**: `createTheme({ focusVisible: {...} })` is required to get the focus ring (createTheme.js:95); `createTheme({ motion: { reducedMotion: "user" } })` exists; package has `sideEffects: false`, so barrel imports tree-shake; icons are already imported by path.
- **@vitejs/plugin-react 6.1.1**: `react({ compiler: true })` uses `oxc-transform-react` (optional peer dep, must be installed); Babel path via `reactCompilerPreset` + `@rolldown/plugin-babel` + `babel-plugin-react-compiler`.
- **framer-motion 13.2.0**: exports `LazyMotion`, `domMax`, `domAnimation`, `MotionConfig` (`reducedMotion="user"`), `useReducedMotion`. `width`, `height` and `backgroundPosition` are JS-driven (not compositor-accelerated); prefer `scaleX`/`x`/`y`/`opacity`.
- **vite 8.2.2**: the build warning itself points to `build.rolldownOptions.output.codeSplitting` (not `manualChunks`); `__dirname` in vite.config.ts is deprecated for the future native config loader.
- **react-router 7.18.3**: supports `createBrowserRouter` with `lazy` route modules and `loader`s, `useOutlet()` (fixes the AnimatePresence + `<Outlet/>` pitfall), `viewTransition` on links, `useNavigation`.
- **@auth0/auth0-react 2.24 / auth0-spa-js 2.24**: options `useRefreshTokens`, `useRefreshTokensFallback`, `cacheLocation` (default memory). Default silent auth uses a hidden iframe that depends on third-party cookies.
- **Vitest 5**: `isolate: false` and `pool` options exist; the report from the current run already recommends them.
- **d3 7.9**: `import * as d3 from "d3"` tree-shakes under rolldown (0 occurrences of unused modules in the bundle). Do NOT convert to d3-* submodule imports; it saves nothing.

### 1.6 Do-not-do list (advice that was considered and rejected)

- Do not move Auth0 tokens to `cacheLocation: "localstorage"` (XSS-readable); use refresh tokens with memory cache instead (F011).
- Do not switch d3 to submodule imports (no bundle benefit).
- Do not add `manualChunks` (Vite 8 rolldown uses `codeSplitting.groups`).
- Do not remove `withSockJS()` on the backend or switch to a raw WebSocket until the API gateway is confirmed to forward `/ws/websocket` in dev (F035).
- Do not add `add_header` inside the asset `location` in nginx.conf: it stops inheriting the security headers (documented in the file).

## 2. Verdict scorecard (1 = poor, 5 = strong)

| Dimension | Score | Why |
|---|---|---|
| Load performance | 1/5 | Uncompressed single 1.15 MB chunk, blank first paint until Auth0 resolves, render-blocking third-party fonts, no cache policy on the shell. |
| Runtime performance | 2/5 | Sound rAF design, but every telemetry tick reconciles the whole dashboard, the canvas redraws unbounded history each frame, and STOMP debug floods the console. |
| Real-time pipeline | 2/5 | Good lock-free queue and coalescing intent, undermined by an inert backoff, a stale JWT on reconnect, dropped packets for the selected driver, and polling. |
| Visual fluidity | 2/5 | Motion is everywhere and often tasteful, but layout-property tweens, wasted blur, a perpetual full-screen gradient sweep and route double-mounts cost real frames. |
| Perceived performance and UX | 2/5 | A fixed 7.5 s gate after login, a white then blank first paint, pessimistic controls and no error or empty states. |
| Architecture and code quality | 3/5 | Strict TypeScript with zero any and a clean compiler-era lint pass, against a 375-line god component, duplicated lifecycles, unused utilities and scattered tokens. |
| Security | 3/5 | Excellent CSP, headers and non-root image; but the bearer token is logged, auth runs on library defaults, and token failures are swallowed. |
| Testing and CI | 3/5 | 188 behavioural tests and sound CI basics, but the PR gate has no typecheck, build, budget or coverage, the visual test is fragile, and there is no end-to-end layer. |
| Accessibility | 1/5 | No visible focus ring, unnamed controls, canvas and charts without alternatives, contrast failures, and reduced motion ignored. |
| Observability and resilience | 2/5 | Retry and dedup intent is right, but there is no error sink, no field metrics, no health endpoint, console-only logging and an inert circuit breaker. |
| Tooling and DX | 3/5 | Modern, current toolchain and an accurate README, but template-level ESLint, no formatter, duplicated config and no declared engines. |

> Headline: The frontend's real-time architecture and security posture are genuinely strong, but the app ships as a single uncompressed 1.15 MB chunk behind a blank first paint and a 7.5 s splash, and its STOMP resilience code does not do what it says because the library ignores it. Three quick-win days remove the worst of that. The remaining work is a disciplined pass over compositing, error states, accessibility and CI gates.

## 3. Findings index

| Id | Sev | Cat | Effort | Pri | Title | Where |
|---|---|---|---|---|---|---|
| F001 | Critical | S1 | S | 10 | The JS bundle is served uncompressed: about 1,147 kB on the wire, not the 358 kB gzip figure the build prints | `frontend/nginx.conf:51` |
| F002 | Critical | S3 | S | 10 | The STOMP reconnect backoff and circuit breaker are inert: the client retries every 5 s forever | `frontend/src/api/stompClient.ts:43` |
| F003 | Critical | S1 | M | 10 | First visit paints nothing until the Auth0 session check completes, then hides the login button for 2.2 s | `frontend/src/App.tsx:175` |
| F004 | High | S3 | S | 9 | The PR gate never typechecks or builds, so a type error merges green and fails in the deploy pipeline | `frontend/.github/workflows/pr-checks.yml:59` |
| F005 | High | S1 | S | 9 | index.html has no Cache-Control: heuristic caching can serve a stale shell that references deleted hashed chunks after a deploy | `frontend/nginx.conf:78` |
| F006 | High | S1 | M | 9 | No code splitting: one 1.15 MB chunk carries every route, and every deploy invalidates all vendor code | `frontend/src/App.tsx:11` |
| F007 | High | S3 | S | 9 | The STOMP debug hook runs in production and logs every frame, including the CONNECT frame carrying the bearer token | `frontend/src/api/stompClient.ts:32` |
| F008 | High | S3 | S | 9 | The JWT is captured once at activation and replayed on every reconnect, so an expired token turns routine reconnects into a permanent auth failure loop | `frontend/src/api/stompClient.ts:72` |
| F009 | High | S2 | M | 9 | The post-login splash is a fixed 7.5 s gate: not skippable, not data-aware, and the app does not mount behind it | `frontend/src/App.tsx:152` |
| F010 | High | S2 | S | 9 | backdrop-filter blur sits on every Paper, the AppBar and the loading overlay, over a fixed-attachment body gradient, next to a 60 fps canvas | `frontend/src/App.tsx:54` |
| F011 | High | S2 | S | 9 | useTelemetry keeps only the last packet per frame, so the selected driver's readout is discarded on most frames | `frontend/src/hooks/useTelemetry.ts:48` |
| F012 | High | S1 | S | 8 | Google Fonts is render-blocking, third-party, and loads the wrong faces | `frontend/index.html:7` |
| F013 | High | S3 | M | 8 | Token acquisition failures are swallowed: requests go out without a bearer and the resulting 401s are only logged | `frontend/src/auth/AuthHandler.tsx:13` |
| F014 | High | S2 | S | 8 | Landing page and splash animate a full-viewport `backgroundPosition` gradient sweep forever — a main-thread, whole-screen repaint every frame on the first screen every user sees | `frontend/src/components/splash/SplashBackground.tsx:35` |
| F015 | High | S2 | S | 8 | prefers-reduced-motion is honoured only by the splash timer; every infinite loop, the Landing page and MUI transitions ignore it | `frontend/src/components/splash/useSplashSequence.ts:29` |
| F016 | High | S1 | M | 8 | Every telemetry packet re-renders the entire /dashboard tree because tick state lives at the RaceSimulator root and no child is memoized | `frontend/src/components/RaceSimulator.tsx:88` |
| F017 | High | S1 | M | 8 | CircuitTrace keeps unbounded history and re-projects and re-strokes every point for every driver on every frame, even when idle | `frontend/src/components/CircuitTrace.tsx:156` |
| F018 | High | S3 | M | 8 | No error or empty states: an analysis-service failure leaves Versus on an infinite skeleton, the Data Vault on a blank chart, and preference saves report success on failure | `frontend/src/pages/VersusMode.tsx:61` |
| F019 | High | S3 | M | 7 | Auth0Provider runs on library defaults (memory cache, no refresh tokens) against a shared *.auth0.com domain, so silent re-auth depends on third-party cookies | `frontend/src/App.tsx:210` |
| F020 | High | S3 | M | 7 | Axios retry policy retries non-idempotent POSTs, mis-parses Retry-After, has no jitter and ignores 502/503/504 | `frontend/src/api/apiClient.ts:47` |
| F021 | High | S3 | M | 7 | No request timeout and no cancellation on any request; abandoned requests keep retrying | `frontend/src/api/apiClient.ts:13` |
| F022 | High | S2 | S | 7 | Route transitions use AnimatePresence mode="wait": pages mount 250 ms late, the exiting wrapper renders the new route, and every route loses its state | `frontend/src/components/layout/LayoutMain.tsx:73` |
| F023 | High | S3 | M | 7 | No error reporting sink or global error handlers; one app-wide ErrorBoundary whose retry budget never resets | `frontend/src/components/ErrorBoundary.tsx:37` |
| F024 | High | S3 | S | 7 | Every button in the app has no visible keyboard focus indicator (MUI 9 focus ring is opt-in and not enabled) | `frontend/src/App.tsx:19` |
| F025 | High | S3 | S | 7 | Play/Pause control is an icon-only IconButton with no accessible name | `frontend/src/components/MediaController.tsx:85` |
| F026 | High | S3 | M | 6 | ESLint is shallow: non-type-aware TS rules, no a11y, no React JSX rules, no import hygiene, `ecmaVersion: 2020` on an ES2022 target | `frontend/eslint.config.js:12` |
| F027 | Medium | S1 | S | 6 | No bundle-size budget or Lighthouse gate — a 1.15 MB single chunk can grow unnoticed in every PR | `frontend/.github/workflows/pr-checks.yml:63` |
| F028 | Medium | S2 | M | 6 | Connection status is polled and misleading: red OFF chips on every load, a permanent 'attempting reconnect' banner, no offline detection | `frontend/src/components/RaceSimulator.tsx:192` |
| F029 | Medium | S2 | S | 6 | StatComparisonBar and HeadToHeadLoader animate `width` (layout property) — 10 simultaneous layout-thrashing tweens on the real page, and 10 *infinite* ones on the loader | `frontend/src/components/versus/StatComparisonBar.tsx:55` |
| F030 | Medium | S2 | S | 6 | RaceSimulator effects are keyed on the whole userProfile object, causing a DriverSelector unmount/remount and driver-reset cascade whenever the profile object changes | `frontend/src/components/RaceSimulator.tsx:83` |
| F031 | Medium | S2 | S | 6 | No devicePixelRatio scaling: canvas backing store is CSS pixels, so the trace, glow dot and text are upscaled and blurry on HiDPI displays | `frontend/src/components/CircuitTrace.tsx:298` |
| F032 | Medium | S3 | S | 5 | Runtime and builder base images still float despite the "pin every image" commit | `frontend/Dockerfile:22` |
| F033 | Medium | S3 | S | 5 | No automated dependency updates or supply-chain gates: no Dependabot config, no audit step, no image scan, actions pinned to majors | `frontend/.github/workflows/pr-checks.yml:59` |
| F034 | Medium | S3 | M | 5 | No runtime validation at the REST or WebSocket boundary — every response is a blind cast | `frontend/src/api/referenceApi.ts:63` |
| F035 | Medium | S3 | L | 5 | Hand-rolled caches with three different shapes, no invalidation and no cancellation; the router's data APIs and React 19 use() are unused | `frontend/src/api/referenceApi.ts:130` |
| F036 | Medium | S3 | S | 5 | Environment config is defined in four places and untyped; the committed VITE_API_BASE_URL is never read | `frontend/src/App.tsx:191` |
| F037 | Medium | S1 | M | 5 | SockJS is unnecessary for the supported browsers and drags in an unmaintained dependency plus a global shim | `frontend/src/api/stompClient.ts:27` |
| F038 | Medium | S3 | S | 5 | Heartbeats driven by setInterval get throttled in background tabs, causing broker-side disconnects; TickerStrategy.Worker is available but unused | `frontend/src/api/stompClient.ts:30` |
| F039 | Medium | S3 | M | 5 | The STOMP subscribe lifecycle is copy-pasted three times and discovers connectivity by 500 ms polling instead of client events | `frontend/src/hooks/useTelemetry.ts:24` |
| F040 | Medium | S2 | S | 5 | Live telemetry numbers re-render up to 60×/s with proportional digits, so the speed/RPM readouts jitter horizontally and reflow the panel every frame | `frontend/src/components/RaceSimulator.tsx:303` |
| F041 | Medium | S1 | S | 5 | Lap correlation re-filters, re-sorts and re-parses dates for every lap on every telemetry packet, then always sets a new object | `frontend/src/components/RaceSimulator.tsx:96` |
| F042 | Medium | S2 | S | 5 | Switching driver resets the camera bounds to Infinity without recomputing from history; the exported computeBounds() helper is unused by the component | `frontend/src/components/CircuitTrace.tsx:84` |
| F043 | Medium | S3 | S | 5 | utils/circuitProjection.ts and utils/radarGeometry.ts have zero production consumers — components re-implement them and drift | `frontend/src/components/CircuitTrace.tsx:194` |
| F044 | Medium | S2 | S | 5 | Versus loads through a serial waterfall, selects drivers pessimistically, and swaps the loader for content with a hard cut | `frontend/src/pages/VersusMode.tsx:45` |
| F045 | Medium | S2 | S | 5 | CircuitTrace 'INITIALIZING' overlay has no timeout and only clears when telemetry for the selected driver arrives | `frontend/src/components/RaceSimulator.tsx:92` |
| F046 | Medium | S3 | M | 5 | console.* is the entire logging strategy (41 call sites), several failures are swallowed, and nothing is gated in production | `frontend/src/context/UserContext.tsx:68` |
| F047 | Medium | S3 | S | 5 | No build/version stamp in the bundle and no production source maps; manual builds push a mutable image tag | `frontend/cloudbuild/frontend.yaml:57` |
| F048 | Medium | S3 | S | 5 | App.tsx (routing, auth guard, splash handoff) has no tests and cannot be imported under jsdom | `frontend/src/App.tsx:95` |
| F049 | Medium | S3 | S | 5 | Native-canvas visual regression: baselines rendered by macOS prebuilt Cairo, CI compiles a different Cairo on Alpine, README misstates the tolerance 100x, and Cloud Build is not detected as CI so missing baselines are silently written | `frontend/src/components/__tests__/CircuitTrace.visual.test.ts:115` |
| F050 | Medium | S3 | S | 5 | No coverage provider, thresholds, or report — and the un-measured gaps are exactly the risky branches (ErrorBoundary retry, DriverSelector onChange, loader timers, CircuitTrace draw args) | `frontend/vitest.config.ts:16` |
| F051 | Medium | S3 | S | 5 | Circuit trace <canvas> has no role, name or text alternative; diagnostics are painted into pixels | `frontend/src/components/CircuitTrace.tsx:296` |
| F052 | Medium | S3 | S | 5 | Text and chart colours below WCAG AA contrast on the dark theme (measured) | `frontend/src/components/CircuitTraceLoadingOverlay.tsx:70` |
| F053 | Medium | S3 | S | 5 | Buttons disable themselves while focused, dropping keyboard focus to <body> after every press | `frontend/src/components/MediaController.tsx:88` |
| F054 | Medium | S3 | M | 5 | /dashboard, /historical, the AppBar and the settings Dialog do not reflow at 375 px | `frontend/src/components/layout/UserSettingsModal.tsx:82` |
| F055 | Medium | S3 | S | 4 | The local Dockerfile compiles the test-only native canvas addon without its toolchain and copies stale files into the builder | `frontend/Dockerfile:13` |
| F056 | Medium | S3 | S | 4 | No formatter, EditorConfig, import-order rule or pre-commit hook; three import styles and naming inconsistencies coexist | `frontend/vitest.config.ts:10` |
| F057 | Medium | S3 | L | 4 | RaceSimulator is a 375-line god component: 13 useState + 4 useRef, domain algorithm inside a render closure | `frontend/src/components/RaceSimulator.tsx:88` |
| F058 | Medium | S3 | M | 4 | Design tokens are not centralised: brand red in 14 files, paper grey in 17 places, font family re-declared 22 times despite the MUI theme | `frontend/src/App.tsx:19` |
| F059 | Medium | S3 | M | 4 | No motion design tokens: 14 distinct durations and 8 easings are scattered across components, and MUI's own transition system is left at defaults, so the app has three uncoordinated timing vocabularies | `frontend/src/App.tsx:19` |
| F060 | Medium | S1 | S | 4 | useLocation/useTelemetry buffers grow without bound while the tab is hidden (rAF paused, WebSocket still delivering) | `frontend/src/hooks/useLocation.ts:46` |
| F061 | Medium | S2 | S | 4 | MediaController play/pause is pessimistic and seek has no error handling or pending state | `frontend/src/components/MediaController.tsx:50` |
| F062 | Medium | S3 | S | 4 | nginx has no health endpoint, unstructured access logs and no explicit Cloud Run probes | `frontend/nginx.conf:82` |
| F063 | Medium | S1 | M | 4 | LapTimeChart rebuilds the whole SVG on every resize tick and twice on mount | `frontend/src/components/LapTimeChart.tsx:168` |
| F064 | Medium | S2 | M | 4 | The D3 charts have no transitions and the radar is rebuilt imperatively while a declarative version already exists in the loader | `frontend/src/components/versus/RadarChart.tsx:17` |
| F065 | Medium | S3 | M | 4 | Lap-time and radar charts are mouse-only SVGs with no title, role or data alternative | `frontend/src/components/LapTimeChart.tsx:176` |
| F066 | Medium | S3 | L | 4 | No end-to-end layer: Auth0 redirect handshake, STOMP reconnect and canvas resize are only ever exercised in production | `frontend/src/test/setup.ts:8` |
| F067 | Medium | S3 | S | 4 | Route changes update neither the document title nor focus; one static <title> for all four routes | `frontend/src/components/layout/LayoutMain.tsx:73` |
| F068 | Medium | S3 | S | 4 | Live telemetry values are rendered as <h2>/<h6> headings; pages have no <h1> and the app name is an <h5> | `frontend/src/components/RaceSimulator.tsx:303` |
| F069 | Medium | S3 | S | 4 | No landmarks or skip link: content lives in generic <div>s, nav buttons are not in a <nav> | `frontend/src/components/layout/LayoutMain.tsx:72` |
| F070 | Medium | S3 | S | 4 | No accessibility test layer, so none of the accessibility findings would be caught by CI | `frontend/eslint.config.js:12` |
| F071 | Low | S1 | S | 4 | React Compiler is not enabled although the codebase already passes the compiler's lint rules and plugin-react 6 supports it natively | `frontend/vite.config.ts:6` |
| F072 | Low | S1 | S | 4 | Vitest creates 38 isolated jsdom environments (35% of wall time); `isolate: false` measured 43% faster, `pool: 'vmThreads'` 39% faster | `frontend/vitest.config.ts:18` |
| F073 | Low | S3 | S | 3 | Cloud Build re-runs lint+test after merge (duplicating the PR gate) and pays a C++ toolchain install on every deploy solely for the canvas test | `frontend/cloudbuild/frontend.yaml:30` |
| F074 | Low | S3 | M | 3 | Frontend deploy shifts 100 % traffic immediately with no smoke test, canary or automated rollback (unlike the api-gateway pipeline) | `frontend/cloudbuild/frontend.yaml:88` |
| F075 | Low | S1 | S | 3 | No Web Vitals / RUM collection, so splash, bundle and live-feed frame health are unmeasured in the field | `frontend/src/main.tsx:5` |
| F076 | Low | S3 | S | 3 | appState.returnTo is passed to navigate() unvalidated, and deep links are dropped on login | `frontend/src/App.tsx:202` |
| F077 | Low | S3 | S | 3 | Auth error screen is a dead end and exposes developer-oriented text and raw Auth0 error strings to end users | `frontend/src/App.tsx:135` |
| F078 | Low | S3 | S | 3 | Only raw-HTML sink in the app: d3 `.html()` interpolates API-supplied driver name and colour into markup and a style attribute | `frontend/src/components/LapTimeChart.tsx:155` |
| F079 | Low | S3 | S | 3 | nginx omits X-Frame-Options, COOP, CORP, `server_tokens off`, and CSP reporting | `frontend/nginx.conf:72` |
| F080 | Low | S3 | S | 3 | Connection status is colour-only and the 'OFF' label loses its subject; state changes are not announced | `frontend/src/components/RaceSimulator.tsx:203` |
| F081 | Low | S3 | S | 3 | Timeline slider thumb reduced to a 16 px hit area with zero padding (below the 24 px target minimum) | `frontend/src/components/MediaController.tsx:105` |
| F082 | Low | S1 | S | 3 | UserContext value object and updatePreferences are recreated on every UserProvider render (React 19 context idiom not used) | `frontend/src/context/UserContext.tsx:78` |
| F083 | Low | S2 | S | 3 | Height-to-'auto' AnimatePresence collapses drive layout of the whole left column each frame and the MediaController toggles run alongside a sibling 'height: 0' Cancel button — two layout tweens stacked | `frontend/src/components/RaceSimulator.tsx:220` |
| F084 | Low | S2 | S | 3 | The per-letter title reveal leaves 13 permanently promoted layers with a residual blur filter | `frontend/src/pages/Landing.tsx:99` |
| F085 | Low | S2 | S | 3 | SplashCircuit drives the orbiting dot via getPointAtLength on every motion-value change and stacks two drop-shadow filters on a moving SVG circle — perpetual main-thread + filter repaint on the Landing page | `frontend/src/components/splash/SplashCircuit.tsx:79` |
| F086 | Low | S1 | M | 3 | framer-motion is bundled eagerly as `motion` (130 kB); `LazyMotion` + `m` with `domMax` is available in 13.2 but unused | `frontend/src/App.tsx:5` |
| F087 | Low | S3 | S | 3 | Dead dependency and dead code: date-fns is never imported, and several exports and state fields have no consumer | `frontend/package.json:22` |
| F088 | Low | S3 | S | 3 | Toolchain and release hygiene: no engines or packageManager, no .nvmrc, five npm scripts, no versioning or changelog | `frontend/package.json:4` |
| F089 | Low | S3 | S | 3 | Duplicated Vite and Vitest config with a __dirname deprecation warning; test globals leak into app types | `frontend/vite.config.ts:9` |
| F090 | Low | S3 | M | 3 | Four independent copies of the cycling-status-message + shimmer-bar loading pattern (HeadToHeadLoader 610 LOC is presentational, not a fetch container) | `frontend/src/components/HeadToHeadLoader.tsx:64` |
| F091 | Low | S3 | S | 3 | act() warnings on every run and sleep-based synchronisation; hook tests wait on real 500 ms intervals (~2.1 s of the 5.7 s suite) | `frontend/src/components/__tests__/RaceSimulator.test.tsx:56` |
| F092 | Low | S3 | M | 2 | No runtime feature flags or kill switches: disabling the live feed, splash or a backend integration requires a rebuild and redeploy | `frontend/src/api/apiClient.ts:5` |
| F093 | Low | S2 | S | 2 | Emoji read aloud in headings, and dead exit animations on the settings dialog and Landing page | `frontend/src/components/layout/UserSettingsModal.tsx:86` |
| F094 | Low | S3 | L | 2 | Folder layout is layer-first with one flat components/ bucket; caching/error ownership is split across api/, context/ and components/ — will not scale to 3x features | `frontend/src/api/referenceApi.ts:51` |
| F095 | Low | S3 | S | 2 | Brittle selectors: inline-style CSS, MUI-internal test IDs, and single-letter text matches; tests also surface an unfixed `ownerState` prop-leak warning | `frontend/src/components/__tests__/DataVaultLoader.test.tsx:45` |
| F096 | Low | S3 | S | 2 | Non-null assertions paper over optional types instead of narrowing them | `frontend/src/components/LapTimeChart.tsx:97` |

## 4. Findings by theme

Themes group findings by root cause; fix a theme together where possible. Within a theme, order is severity then priority.

### Theme: Delivery to the browser (S1 Performance)

_Everything between the build and the first byte the browser can use: compression, shell caching, code splitting, fonts and a budget to keep it that way._

Findings: F001, F005, F006, F012, F027, F047

#### F001 · Critical · S1 Performance · effort S · priority 10/10

**The JS bundle is served uncompressed: about 1,147 kB on the wire, not the 358 kB gzip figure the build prints**

- Where: `frontend/nginx.conf:51`
- Evidence: frontend/nginx.conf:51 `server {` … :96 `location ~* \.(?:ico|css|js|gif|jpe?g|png|svg|webp|woff2?)$ {` … :98 `expires max;` … :100 `}` — the whole server block contains no `gzip`/`gzip_static`/`brotli` directive. infra…
- Problem: Nothing between the container and the browser compresses responses. nginx inherits the upstream default (gzip commented out), the repo's server block adds none, Cloud Run does not compress, and the external managed LB backend has compression_mode unset (default DISABLED). The '358 kB gzip' figure Vite prints is therefore never realised in production; the browser downloads the full 1,146,924-byte script (plus uncompressed index.html).
- Impact: Every first visit and every post-deploy revisit transfers ~1.15 MB of JavaScript. On a 10 Mbit/s mobile link that is ~0.9 s of pure transfer versus ~0.3 s compressed (or ~0.25 s with brotli). This is the single largest load-time lever in the app — roughly 3x the savings of everything else in this report combined — and it also inflates Cloud Run egress cost by ~3x per page view.
- Fix: Do both. (1) Edge: add compression_mode = "AUTOMATIC" to google_compute_backend_service.default in infrastructure/modules/lb-frontend/main.tf so the managed load balancer negotiates brotli or gzip per request. (2) Origin, which also covers the raw run.app URL and local docker runs: add gzip on, gzip_vary on, gzip_min_length 1024 and gzip_types for javascript, json, css and svg to the server block in nginx.conf; or precompress at build time with vite-plugin-compression2 (emits .br and .gz beside each asset) and serve them with gzip_static on. Expected wire size: roughly 300 kB brotli or 358 kB gzip.
- Risk: Load balancer compression adds Vary: Accept-Encoding; check it does not disturb the far-future caching of hashed assets. Precompression lengthens the build slightly.
- Verified: nginx.conf has no gzip or brotli directive; the upstream nginx image ships gzip commented out; Cloud Run does not compress; infrastructure/modules/lb-frontend/main.tf sets no compression_mode. The deployed host could not be reached from this sandbox, so confirm on production with the curl command in the appendix before scheduling.

#### F005 · High · S1 Performance · effort S · priority 9/10

**index.html has no Cache-Control: heuristic caching can serve a stale shell that references deleted hashed chunks after a deploy**

- Where: `frontend/nginx.conf:78`
- Evidence: frontend/nginx.conf:78 `location / {` :79 `root /usr/share/nginx/html;` :82 `try_files $uri $uri/ /index.html;` :83 `}` — no `expires`/Cache-Control. :96-99 assets get `expires max;` (`Cache-Control: max-age=315360000`)…
- Problem: nginx emits `Last-Modified` + `ETag` for index.html and no freshness header, so browsers (and any intermediary) apply RFC 9111 heuristic freshness — typically 10% of the file's age. The image's mtime is the build time, so an index.html deployed days ago can be considered fresh for hours. The only asset it references is content-hashed and the old hash is gone from the new image, while a cached old asset would in any case be served for 10 years.
- Impact: After each Cloud Run deploy, users with a heuristically-cached index.html request `/assets/index-<oldhash>.js`, which now 404s (try_files falls through to index.html, so the browser receives HTML for a module script → hard failure, blank page) until they force-refresh. This is a user-visible outage window per deploy, silently proportional to time-since-last-deploy. It also blocks the vendor-chunk caching win below, because index.html is the thing that must always be revalidated.
- Fix: Add, without touching `add_header` (preserving the inheritance rationale at nginx.conf:57-61): `location = /index.html { root /usr/share/nginx/html; expires -1; }` — `expires -1` makes nginx emit `Cache-Control: no-cache` plus a past `Expires`, so the shell is always revalidated (ETag → 304 when unchanged) while security headers still inherit. Keep `location /` as is for the SPA fallback. Since public/ files (speed-favicon.svg) are unhashed but referenced from index.html, this also makes the comment at :88-90 true.
- Verified: Confirmed: the location / block sets no Cache-Control and index.html is not content-hashed, while the chunk it references is renamed on every deploy. nginx emits Last-Modified and ETag, so browsers apply heuristic freshness to the shell.

#### F006 · High · S1 Performance · effort M · priority 9/10

**No code splitting: one 1.15 MB chunk carries every route, and every deploy invalidates all vendor code**

- Where: `frontend/src/App.tsx:11`
- Evidence: frontend/src/App.tsx:11 `import Home from './pages/Home';` :12 `import HistoricalData from './pages/HistoricalData';` :13 `import VersusMode from './pages/VersusMode';` :231 `<StompAuthHandler />` (rendered unconditiona…
- Problem: The unauthenticated `/` Landing page — a login button with an animation — pays for d3, the canvas circuit trace, the lap chart, radar chart, Autocomplete/Dialog/Slider/Snackbar and the STOMP/SockJS stack, none of which can render until after Auth0 login and a ~7 s splash. Vite/rolldown already splits on dynamic `import()`, so this is purely an App.tsx structure issue.
- Impact: Measured 159 kB minified / 52 kB gzip (14.5%) of avoidable JS on the first route before login, plus 65 kB / 19.6 kB gz for the WebSocket stack, ≈ 72 kB gz (20%) total. For a returning logged-in user the deferred chunks load during the 7 s splash, so the split has zero perceived cost on the app side.
- Fix: Lazy-load the three authenticated pages with React.lazy and a Suspense boundary inside the existing motion wrapper; move StompAuthHandler under RequiredAuth so the STOMP and SockJS code leaves the public Landing route; add build.rolldownOptions.output.codeSplitting.groups in vite.config.ts with groups for react, mui (with emotion and popper), auth0, motion and d3 so vendor chunks keep their hash across app-only deploys. Prefetch the dashboard chunk with a dynamic import during the splash. Expected: the Landing route drops to roughly a third of today's JS, and returning users re-download only the app chunk after a deploy.
- Risk: Route chunks add one request on first navigation; the splash prefetch hides it.
- Verified: Confirmed by the build (a single chunk) and by App.tsx, which imports every page statically and mounts StompAuthHandler at the root. The finder's statement that Vite 8 replaced manualChunks with output.codeSplitting matches the warning printed by the installed vite 8.2.2.

#### F012 · High · S1 Performance · effort S · priority 8/10

**Google Fonts is render-blocking, third-party, and loads the wrong faces**

- Where: `frontend/index.html:7`
- Evidence: frontend/index.html:7 `<link href="https://fonts.googleapis.com/css2?family=Titillium+Web:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">` — no `<link rel="preconnect">` for fonts.googleapis.com …
- Problem: The stylesheet is on the critical path (external CSS blocks first render) and needs two cold cross-origin connections (googleapis for CSS, gstatic for woff2) that nothing warms. The face list is wrong for the design: weight 300 is downloaded and never used; 700-italic (theme h1/h4) and 900 (hero title on Landing, AppBar, Splash) are used but not requested, so the browser synthesises faux-italic from the 700 upright and faux-bold from 700 for 900 (Titillium Web has 900 upright only, no 900 italic).
- Impact: Roughly two extra DNS+TLS handshakes (~100-300 ms on mobile) before text can paint in the intended face, one wasted ~15 kB woff2 (300), and the brand headline on the very first screen renders as a synthesised, visibly different glyph set from the real Titillium 900/700-italic. `display=swap` avoids invisible text but guarantees a FOUT on every cold load.
- Fix: Self-host with @fontsource/titillium-web, importing only 400, 600, 700, 700-italic and 900 in main.tsx; Vite emits hashed woff2 files served under the existing far-future cache rule. Remove the Google Fonts link and the two Google origins from style-src and font-src in nginx.conf. Add font-display: swap through the fontsource CSS, which is the default.
- Verified: Confirmed in index.html and on the served Landing page: the stylesheet is a render-blocking link with no preconnect; weights 300 and 600 are requested but never used, while 700 italic (theme h1 and h4) and 900 (Landing and splash title) are used but never requested, so the browser synthesises them. Self-hosting also removes two third-party origins from the CSP and stops sending every visitor's IP to Google before the app boots.

#### F027 · Medium · S1 Performance · effort S · priority 6/10

**No bundle-size budget or Lighthouse gate — a 1.15 MB single chunk can grow unnoticed in every PR**

- Where: `frontend/.github/workflows/pr-checks.yml:63`
- Evidence: pr-checks.yml:62-63 - name: Test run: yarn test:ci (no step after this; no size/perf check anywhere) vite.config.ts:5-13 (no build section) export default defineConfig({ plugins: [react()], resolve: { alias: { '@': path…
- Problem: The measured build is one 1,146.90 kB / 358.38 kB gzip chunk (CONTEXT baseline) and Vite already warns about it, but nothing in CI reads that warning or compares against a budget. Adding a second d3 sub-package, another MUI icon barrel import, or accidentally importing `framer-motion` in a util would add hundreds of kB with no signal. There is no Lighthouse CI either, even though `/` (Landing) is public and could be audited unauthenticated.
- Impact: Time-to-interactive on the public landing page and the post-login dashboard regresses silently; with a 358 kB gzip payload already on a mobile connection, each unnoticed 10% growth is user-visible.
- Fix:

  Add `size-limit` with `@size-limit/file` (`yarn add -D size-limit @size-limit/file`) and `.size-limit.json`:
  ```json
  [{ "path": "dist/assets/*.js", "limit": "370 kB", "gzip": true }]
  ```
  plus script `"size": "size-limit"` and a PR step `run: yarn size` after the build step (use `andresz1/size-limit-action@v1` for a PR comment with the delta). Set `build.chunkSizeWarningLimit` deliberately in vite.config.ts once code-splitting lands so the warning becomes meaningful. Optionally add `treosh/lighthouse-ci-action@v12` against `yarn preview --port 4173` for `/` with a `budget.json` (`resourceSizes: script 400kB`, `interactive 4000ms`).

- Verified: Confirmed: neither pipeline reads the chunk-size warning or enforces a budget. Lowered from high because it is a guard rather than a current defect.

#### F047 · Medium · S3 Enterprise · effort S · priority 5/10

**No build/version stamp in the bundle and no production source maps; manual builds push a mutable image tag**

- Where: `frontend/cloudbuild/frontend.yaml:57`
- Evidence: cloudbuild/frontend.yaml:9-11 substitutions: _ENV: 'dev' _SHORT_SHA: 'manual-build' cloudbuild/frontend.yaml:54-58 - name: 'node:26-alpine' id: 'build' entrypoint: 'yarn' args: ['build', '--mode', '${_ENV}'] vite.config…
- Problem: Cloud Build knows `_SHORT_SHA` but does not pass it into the Vite build, so no commit id exists anywhere in the served page (no `<meta>`, no console banner, no footer, no header). Vite's default `build.sourcemap: false` means the single minified 1.15 MB chunk produces stack traces like `index-CHqy23WB.js:1:48213` that cannot be symbolicated. `_SHORT_SHA` defaults to the literal `manual-build`, so any manually triggered build overwrites the same `:manual-build` tag, breaking the immutability the deploy step relies on.
- Impact: During an incident support cannot ask 'which build are you on?' and cannot map a reported error to a commit or a deploy time; every rollback decision is guesswork. Without hidden source maps an error-reporting tool (see the error-reporting finding) is of limited value.
- Fix:

  ```ts
  // vite.config.ts
  define: { global: 'window', __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'local'), __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: { sourcemap: 'hidden' },
  ```
  Cloud Build step 4: `env: ['APP_VERSION=${_SHORT_SHA}']`; fail the build if `_SHORT_SHA == 'manual-build'` (`[ "$_SHORT_SHA" != manual-build ] || exit 1`) or use `$COMMIT_SHA`. In `main.tsx` log one line `console.info('f1v', __APP_VERSION__, import.meta.env.MODE)` and expose it in the footer and in `window.__F1V__`. Add `location ~* \.map$ { return 404; }` to nginx.conf (or copy `dist/**/*.map` out before `Dockerfile.ci` COPY) and upload the maps to the error reporter / a GCS bucket keyed by version.

- Verified: Confirmed: _SHORT_SHA is never passed into the Vite build, build.sourcemap is unset, and a manual build pushes the literal tag manual-build.

### Theme: The first seconds after arrival (S2 Fluidity)

_A white frame, then nothing until Auth0 answers, then a 7.5 s splash that gates the whole app, on top of a landing page that repaints a viewport-sized gradient every frame forever._

Findings: F003, F009, F014, F084, F085

#### F003 · Critical · S1 Performance · effort M · priority 10/10

**First visit paints nothing until the Auth0 session check completes, then hides the login button for 2.2 s**

- Where: `frontend/src/App.tsx:175`
- Evidence: src/App.tsx:172-177 const LandingGate: React.FC = () => { const { isAuthenticated, isLoading } = useAuth0(); if (isLoading) { return null; } src/App.tsx:205-207 if (!(domain && clientId && audience)) { return null; } in…
- Problem: The LCP path on a cold visit is: download+parse the single 1.15 MB / 358 kB-gzip chunk (nothing is painted before JS runs because index.html carries no background colour or critical CSS, so the page flashes white then black) -> Auth0Provider mounts and runs checkSession(), which with the default in-memory cache means an iframe /authorize?prompt=none round-trip to the Auth0 tenant -> only then does LandingGate stop returning null -> Landing fades in over 0.5 s, the title letters start at 0.5 s, and the only interactive element (the login button) is held invisible until delay: 2.2 s. Auth0's isLoading exists to gate *protected* content; a public marketing/landing page has no reason to wait on it. A missing env var also silently renders a blank page (line 205-207).
- Impact: Every new visitor stares at a blank (white, then black) screen for JS-download + Auth0 round-trip, then waits another ~2.7 s before they can log in. On a slow tenant or throttled network the site looks broken. This is the single largest contributor to bounce on the only public page, and it drags LCP/INP scores for the whole app.
- Fix: Render <Landing /> immediately regardless of isLoading and only redirect to /dashboard once isAuthenticated resolves true; the page has no auth-dependent content. In index.html add an inline style setting html background to #101010 (allowed by the current style-src), plus meta color-scheme dark, theme-color and description. Bring the login button in within the first 600 ms and let the decorative animation continue behind it instead of delaying the only interactive element by 2.2 s.
- Risk: If a user is already authenticated they will briefly see the Landing page before the redirect; keep the redirect and accept the flash, or hold only the button until auth resolves.
- Verified: Measured on the production build served locally: first contentful paint landed at 3.6 s although the script was ready at 65 ms, because LandingGate returns null while Auth0 isLoading is true. The sandbox blocks the Auth0 host so the number is inflated, but the structure is exactly what the code does. index.html has no background colour, so the pre-hydration frame is white on a dark app.

#### F009 · High · S2 Fluidity · effort M · priority 9/10

**The post-login splash is a fixed 7.5 s gate: not skippable, not data-aware, and the app does not mount behind it**

- Where: `frontend/src/App.tsx:152`
- Evidence: src/App.tsx:152-165 <AnimatePresence mode="wait"> {showSplash ? ( <SplashScreen key="splash" onComplete={() => setShowSplash(false)} /> ) : ( <motion.div key="app-content" initial={{ opacity: 0 }} animate={{ opacity: 1 …
- Problem: `<Outlet />` is the *else* branch of the splash ternary inside `AnimatePresence mode="wait"`, so LayoutMain and the dashboard do not mount until the 7000 ms timeline fires onComplete, the 500 ms splash exit finishes, and then the 400 ms app fade plus LayoutMain's own 250 ms route enter run. Only fetchDrivers/fetchSessions are prefetched; SessionControlPanel's fetchYears → fetchSessionsByYear → fetchSessionDrivers cascade (SessionControlPanel.tsx:38-88), the STOMP subscribe polling (useLocation.ts:28 500 ms interval) and the driver Autocomplete all start cold after the splash. The splash is a fixed z-index 9999 overlay (SplashScreen.tsx:47-49) so it could sit over a live, already-mounting app. There is no click/keypress skip. The timeline is a fixed wall clock, not gated on the prefetch promises, so on a fast network the user waits for nothing and on a slow one the dashboard still shows spinners afterwards.
- Impact: Every login costs ~8 s before any interactive content, then a second wave of loading spinners. For a telemetry dashboard this reads as slowness rather than polish, and repeat users (the sessionStorage flag is set on every redirect callback, App.tsx:201) pay it every time.
- Fix: Mount the app underneath the splash overlay so data, the STOMP handshake and route chunks load behind it. Finish the splash at the later of a 2 s brand minimum and all prefetches settling, capped at today's 7 s; derive the progress bar from settled requests instead of a clock; add a skip control and remember the choice; surface prefetch failures instead of swallowing them.
- Risk: Shortens the intro for users with fast connections. Keep the animation, just let it end when the app is ready.
- Verified: Confirmed: useSplashSequence.ts drives onComplete from a 7,000 ms timeline plus a 500 ms hold, and App.tsx renders <Outlet /> only in the else branch of the splash ternary, so LayoutMain, the STOMP handshake and the dashboard mount only after it ends. The prefetch promises are discarded with void, so failures surface only as unhandled rejections.

#### F014 · High · S2 Fluidity · effort S · priority 8/10

**Landing page and splash animate a full-viewport `backgroundPosition` gradient sweep forever — a main-thread, whole-screen repaint every frame on the first screen every user sees**

- Where: `frontend/src/components/splash/SplashBackground.tsx:35`
- Evidence: src/components/splash/SplashBackground.tsx:26-42 <motion.div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 0%, transparent 40%, rgba(225,6,0,0.06) 50%, transparent 60%, transp…
- Problem: `backgroundPosition` is not WAAPI-accelerated in motion-dom 13.2 (accelerated set is opacity/clipPath/filter/transform/backgroundColor), so framer updates the inline style from JS every frame, and each update rasterises a 200%×200% viewport gradient. On the Landing page this runs indefinitely at 60 fps alongside the pulsing radial glow, the infinite `SplashCircuit continuous` orbit (getPointAtLength per frame + two stacked drop-shadow filters, SplashCircuit.tsx:79-85, 161) and the login-button glow. The two smaller shimmer bars use the same paint-bound technique.
- Impact: The unauthenticated landing page — the marketing front door — burns a full-screen repaint per frame; on laptops this is audible fan spin and on phones it drops the letter-reveal and circuit-draw to a stutter. Lighthouse 'Avoid non-composited animations' flags it.
- Fix:

  Move the sweep to a transform: render the gradient into an oversized child and translate it.
  ```tsx
  <Box sx={{ position:'absolute', inset:0, overflow:'hidden' }}>
    <motion.div style={{ position:'absolute', width:'200%', height:'200%', top:0, left:0, background: SWEEP_GRADIENT, willChange:'transform' }}
                animate={{ x: ['0%', '-50%'], y: ['0%', '-50%'] }} transition={{ duration: 2.5, ease:'easeInOut', repeat: Infinity, repeatType:'reverse' }} />
  </Box>
  ```
  Same for the shimmer bars (SplashProgress.tsx:64-79, CircuitTraceLoadingOverlay.tsx:124-134): make the gradient child `width: 200%` and animate `x: ['0%', '-50%']` — this is how CircuitTraceIdleOverlay.tsx:78-86 and DataVaultLoader.tsx:309-322 already do it correctly. Gate all three behind `useReducedMotion()`.

- Verified: Confirmed at SplashBackground.tsx:35, where backgroundPosition is animated with repeat: Infinity, and the component is reused by the Landing page. backgroundPosition is not compositor-accelerated, so every frame re-rasterises a viewport-sized gradient on the main thread for as long as the page is open.

#### F084 · Low · S2 Fluidity · effort S · priority 3/10

**The per-letter title reveal leaves 13 permanently promoted layers with a residual blur filter**

- Where: `frontend/src/pages/Landing.tsx:99`
- Evidence: src/pages/Landing.tsx:20-28 hidden: { opacity: 0, y: 20, filter: 'blur(8px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] as const } } src/pages/Landing.t…
- Problem: Each of the 13 letters is a separate compositing layer (`willChange: 'transform, opacity, filter'` is set inline and never removed, so the layers persist for the life of the page — on Landing, forever). Animating `filter: blur` re-rasterises each glyph layer per frame during the 0.3 s tween, which is fine once, but the text is requested at weight 900 italic while the Google Fonts URL only loads 300/400/600/700 upright and 400 italic — the browser synthesizes both bold and oblique, and synthetic faux-bold is exactly the case where a blur→sharp transition shows visible ringing/edge shimmer. The AppBar title repeats the 900-italic request with `background-clip: text`, which forces its own repaint layer.
- Impact: The hero title reveal looks slightly soft/aliased at the end of the tween on Windows/Chrome and the landing page holds ~13 extra GPU layers for as long as it is open; the same faux-weight also makes the header title heavier than designed.
- Fix: Load what you use: `…Titillium+Web:ital,wght@0,400;0,600;0,700;0,900;1,700;1,900&display=swap` (or drop to the 700 italic the family actually ships and set `fontWeight: 700`). Drop the blur from the letter variants and keep `opacity` + `y` (both WAAPI-accelerated) — or keep blur but remove the inline `willChange` so the layer is created only for the tween's duration (framer promotes automatically while animating). If the layer is kept intentionally, clear it in `onAnimationComplete` via `style.willChange = 'auto'`.
- Verified: Confirmed on the served Landing page: 13 letter spans keep will-change transform, opacity, filter and a residual blur(0px) for the life of the page.

#### F085 · Low · S2 Fluidity · effort S · priority 3/10

**SplashCircuit drives the orbiting dot via getPointAtLength on every motion-value change and stacks two drop-shadow filters on a moving SVG circle — perpetual main-thread + filter repaint on the Landing page**

- Where: `frontend/src/components/splash/SplashCircuit.tsx:79`
- Evidence: src/components/splash/SplashCircuit.tsx:63-70 const delay = continuous ? 2200 : ...; const timer = setTimeout(() => { controls = animate(dotProgress, 1, { duration: 2.5, repeat: Infinity, ease: 'linear' }); }, delay); s…
- Problem: `animate()` on a plain MotionValue is a JS-frame-loop animation; each tick calls `SVGGeometryElement.getPointAtLength` (a synchronous geometry query) and writes two SVG attributes, and because the circle carries two chained `drop-shadow` filters the browser re-renders the filter region every frame. The whole SVG (path with its own drop-shadow) is invalidated as the dot moves. On the Landing page this runs indefinitely, on top of the gradient sweep and glow pulses.
- Impact: Continuous ~1–2 ms/frame of main-thread work plus filter raster on the unauthenticated landing page; noticeable as heat/fan noise on laptops left on the login screen and stutter on phones.
- Fix: Use CSS Motion Path, which the compositor can drive: give the dot `style={{ offsetPath: `path('${CIRCUIT_PATH}')`, offsetRotate: '0deg' }}` and animate `offsetDistance: ['0%', '100%']` with framer (`animate={{ offsetDistance: ['0%','100%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}`) — no `getPointAtLength`, no attribute writes. Replace the stacked drop-shadows with a pre-blurred glow: draw a second `<circle r={12} fill="url(#glow)">` using a `<radialGradient>` in `<defs>` (one paint, no filter), and move the path's drop-shadow to a single `<feGaussianBlur>` filter applied to a static duplicate path drawn once. Skip the orbit entirely under `useReducedMotion()`.
- Verified: Confirmed: the orbiting dot is positioned with getPointAtLength on every motion-value change and carries two drop-shadow filters.

### Theme: The STOMP client fights its own library (S3 Enterprise)

_Backoff, breaker, token refresh, heartbeats and connectivity are all reimplemented around @stomp/stompjs instead of using the hooks it provides, and the library silently ignores most of it._

Findings: F002, F007, F008, F028, F038, F039, F037

#### F002 · Critical · S3 Enterprise · effort S · priority 10/10

**The STOMP reconnect backoff and circuit breaker are inert: the client retries every 5 s forever**

- Where: `frontend/src/api/stompClient.ts:43`
- Evidence: src/api/stompClient.ts:38-43 onWebSocketClose: () => { reconnectAttempts++; // Circuit breaker — stop hammering the server after repeated failures. if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) { stompClient.reconnect…
- Problem: The library snapshots `reconnectDelay` into a private `_nextReconnectDelay` only in `activate()` and after a successful CONNECT. Assignments to `stompClient.reconnectDelay` inside `onWebSocketClose` are never read by `_schedule_reconnect()`, so the exponential ladder (5s,10s,20s,40s,60s) is never applied, and setting it to 0 does not stop reconnection. The client retries every 5 s (plus nothing) forever. The unit test mocks the Client class entirely (src/api/__tests__/stompClient.test.ts:5-21), so this cannot be caught by the suite.
- Impact: Exactly the failure the file's own comment warns about: every SockJS handshake (GET /ws/info) bypasses the Axios 429 interceptor, and a client that cannot connect (backend down, expired JWT — see the token-expiry finding, cold start) hammers the API gateway every 5 s indefinitely, burning the shared rate-limit budget for the REST calls on the same origin and keeping the 'CONNECTION LOST' snackbar permanently on screen. In an outage every open tab of every user becomes a 0.2 req/s retry source with no cap.
- Fix: Delete the hand-rolled ladder in stompClient.ts. Configure the client with reconnectDelay: 5000, maxReconnectDelay: 60000 and reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL, which is the library's built-in truncated exponential backoff (available since 7.1). For the breaker, count consecutive failures in onWebSocketClose and call stompClient.deactivate(), the documented way to stop reconnecting, then publish a 'feed unavailable' state so the UI can offer a retry. Add jitter, if still wanted, by awaiting a random delay inside beforeConnect. Update stompClient.test.ts to assert the library options rather than the mutated field.
- Risk: Behaviour only changes while the socket is flapping; exercise it with the telemetry service stopped.
- Verified: Verified in node_modules/@stomp/stompjs/esm6/client.js: _schedule_reconnect() reads the private _nextReconnectDelay, which is assigned from reconnectDelay only in activate() and in the onConnect handler. Assignments made inside onWebSocketClose never reach the timer that is armed immediately afterwards, so the exponential ladder, the jitter and the reconnectDelay = 0 breaker are all inert. The unit tests assert the intent, not the library behaviour.

#### F007 · High · S3 Enterprise · effort S · priority 9/10

**The STOMP debug hook runs in production and logs every frame, including the CONNECT frame carrying the bearer token**

- Where: `frontend/src/api/stompClient.ts:32`
- Evidence: src/api/stompClient.ts:32: `debug: (str) => console.log('[STOMP]:', str),` src/api/stompClient.ts:72: `stompClient.connectHeaders = { Authorization: `Bearer ${token}` };` node_modules/@stomp/stompjs/src/stomp-handler.ts…
- Problem: @stomp/stompjs 7.3 routes every transmitted frame through `debug()`; `FrameImpl.toString()` serialises the command plus all headers, so the CONNECT frame is emitted as `[STOMP]: >>> CONNECT\nAuthorization:Bearer eyJ...` on every connect and on every automatic reconnect (up to 6 attempts under the circuit breaker). The hook is unconditional — not gated on `import.meta.env.DEV` — and the build has no console stripping, so this ships in the prod bundle.
- Impact: A bearer token for `api.f1visualizer.com` (default Auth0 API token lifetime 24 h) sits in the DevTools console of every session. It is captured by any browser extension with console access, by users pasting console output into bug reports/screenshots, and by any error-monitoring SDK that records console breadcrumbs. A pasted token replays against the REST API and the STOMP endpoint until expiry.
- Fix: Set debug to a no-op unless import.meta.env.DEV (or a VITE_STOMP_DEBUG flag for UAT), and even then skip messages that start with '>>> CONNECT'. Gate the periodic '[GPS]' and '[CircuitTrace] Drained' logs the same way. Vite tree-shakes the DEV branch in production builds.
- Verified: Confirmed in node_modules/@stomp/stompjs/esm6/stomp-handler.js: _transmit() calls debug with the serialised outgoing frame, including CONNECT with its Authorization header, and every inbound frame is logged with a '<<<' prefix. stompClient.ts wires debug to console.log with no environment guard, so this runs in production at roughly a hundred calls per second during replay.

#### F008 · High · S3 Enterprise · effort S · priority 9/10

**The JWT is captured once at activation and replayed on every reconnect, so an expired token turns routine reconnects into a permanent auth failure loop**

- Where: `frontend/src/api/stompClient.ts:72`
- Evidence: src/api/stompClient.ts:71-76 export function activateWithToken(token: string): void { stompClient.connectHeaders = { Authorization: `Bearer ${token}` }; if (!stompClient.active) { stompClient.activate(); src/auth/StompA…
- Problem: `connectHeaders` is set exactly once (effect deps only change on login/logout) and the library re-sends the same headers on every library-driven reconnect because `beforeConnect` is left as noOp. The broker validates the JWT (including `exp`) on every CONNECT. Cloud Run terminates WebSockets at its request timeout (max 60 min) and the Spring heartbeat closes idle/throttled sessions, so reconnects are routine; once the access token's `exp` has passed every reconnect is rejected with an ERROR frame and socket close, and — because of the backoff finding — retried every 5 s forever with the same dead token. `getAccessTokenSilently()` (auth0-react 2.24) would return a refreshed token from cache, but it is never consulted again.
- Impact: Long sessions (a full race is ~2 h; users leaving the dashboard open all afternoon) silently lose the live feed after token expiry: 'CRITICAL: LIVE FEED CONNECTION LOST' is shown and never clears until a manual page reload, while the REST side (axios interceptor fetches a fresh token per request) keeps working, which makes the failure confusing to diagnose.
- Fix: Move token acquisition into the client's beforeConnect hook: StompAuthHandler registers a token provider (getAccessTokenSilently) and beforeConnect sets connectHeaders from a fresh token before every CONNECT. Drop the module-level activateWithToken.
- Verified: Confirmed: activateWithToken sets connectHeaders once per login; the library re-sends the same headers on every reconnect and beforeConnect is left as a no-op. Cloud Run closes WebSockets at its request timeout, so reconnects after the token's lifetime are routine rather than exceptional.

#### F028 · Medium · S2 Fluidity · effort M · priority 6/10

**Connection status is polled and misleading: red OFF chips on every load, a permanent 'attempting reconnect' banner, no offline detection**

- Where: `frontend/src/components/RaceSimulator.tsx:192`
- Evidence: RaceSimulator.tsx:192 const connectionLost = activeSession !== null && (!isTelemetryConnected || !isLocationConnected); RaceSimulator.tsx:360-364 <Snackbar open={connectionLost} ...> <Alert severity="error" variant="fil…
- Problem: Connectivity is sampled by polling `stompClient.connected` every 500 ms in three places instead of subscribing to the client's `onConnect`/`onWebSocketClose`/`onHeartbeatLost`/`onStompError` events, so state lags by up to 500 ms, three timers run for the life of the dashboard, and there is no notion of 'reconnecting' vs 'gave up' vs 'auth rejected' vs 'device offline'. The banner text hard-codes 'ATTEMPTING RECONNECT' regardless of whether reconnection is actually happening (see the circuit-breaker finding) and shows the same message in airplane mode as in a backend outage. Chips read 'OFF' in red even before a session starts.
- Impact: Users cannot distinguish 'my Wi-Fi dropped' (nothing to do but wait) from 'the telemetry service is down' (reload will not help) from 'my session expired' (must sign in again). Support tickets lack the one fact that decides the runbook. The pollers also cost a React state flip and re-render of RaceSimulator on every transition.
- Fix: Publish a status enum (idle, connecting, connected, reconnecting, auth-rejected, circuit-open, offline) from the client callbacks through a tiny external store consumed with useSyncExternalStore; remove the three pollers; drive chips and banner from it; listen to navigator.onLine.
- Verified: Confirmed: connection chips derive from polled booleans, so both feeds show red OFF for the first seconds of every dashboard load, and the reconnect banner text is hard-coded regardless of whether the client is still trying.

#### F038 · Medium · S3 Enterprise · effort S · priority 5/10

**Heartbeats driven by setInterval get throttled in background tabs, causing broker-side disconnects; TickerStrategy.Worker is available but unused**

- Where: `frontend/src/api/stompClient.ts:30`
- Evidence: src/api/stompClient.ts:29-31 reconnectDelay: BASE_RECONNECT_DELAY, heartbeatIncoming: 10000, // Wait for heartbeat every 10s heartbeatOutgoing: 10000, // Send heartbeat every 10s node_modules/@stomp/stompjs/esm6/client.…
- Problem: The client heartbeat ticker defaults to `setInterval`. Chrome's intensive throttling aligns timers in hidden tabs to one wake-up per minute after ~5 min in background (Safari and Firefox throttle earlier), so the 10 s outgoing PING is missed; the Spring simple broker expects one within 10 s (x tolerance) and closes the session. On every return to the tab the user sees the 'connection lost' snackbar until the 5 s reconnect + up to 500 ms subscription poll complete, and each of those reconnects consumes /ws/info rate-limit budget (and, per the token finding, may fail entirely after expiry).
- Impact: Users who keep the dashboard open in a background tab while a race is on (the natural usage pattern for a live-timing tool) get a reconnect storm and lose the accumulated circuit trace every time they tab back; it also inflates backend connection churn.
- Fix: import { Client, TickerStrategy } from '@stomp/stompjs'; ... heartbeatStrategy: TickerStrategy.Worker, // stompjs >= 7.1; falls back to Interval where Workers are unavailable heartbeatIncoming: 10000, heartbeatOutgoing: 10000, Optionally set `heartbeatIncoming` a little above the server's 10 s (e.g. 15000) so a single delayed frame does not trip the client-side watchdog. Keep the values in sync with WebSocketConfig.java:36 via a comment.
- Verified: Confirmed: TickerStrategy.Worker exists in the installed @stomp/stompjs 7.3.0 and heartbeatStrategy is left at the Interval default, which browsers throttle in background tabs.

#### F039 · Medium · S3 Enterprise · effort M · priority 5/10

**The STOMP subscribe lifecycle is copy-pasted three times and discovers connectivity by 500 ms polling instead of client events**

- Where: `frontend/src/hooks/useTelemetry.ts:24`
- Evidence: useTelemetry.ts:24-42 const checkConnection = setInterval(() => { if (stompClient.connected && !subscription) { setIsConnected(true); subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => { ...…
- Problem: The 500 ms connectivity poll + subscribe/resubscribe state machine is duplicated verbatim in useTelemetry, useLocation and MediaController. MediaController bypasses the hooks layer entirely and talks to `stompClient` directly, so the module boundary 'api/ owns the socket, hooks/ own subscriptions' is already broken. Polling `stompClient.connected` is also the wrong primitive: @stomp/stompjs 7 exposes `onConnect`/`onDisconnect`/`onChangeState` callbacks, so the interval exists only because the singleton hides them. A fourth topic (e.g. race control messages) will be a fourth copy.
- Impact: Any fix to reconnect semantics (e.g. the resubscribe-after-reconnect bug class the comments describe) must be applied in three places and can silently diverge; MediaController already lacks the `setIsConnected` bookkeeping the hooks have. Three 500 ms timers run whenever the dashboard is mounted.
- Fix:

  Create `src/realtime/useStompSubscription.ts`:
  ```ts
  export function useStompSubscription<T>(destination: string, schema: z.ZodType<T>, onMessage: (msg: T) => void) {
    const cb = useEffectEvent(onMessage); // React 19
    const [connected, setConnected] = useState(stompClient.connected);
    useEffect(() => {
      let sub: StompSubscription | null = null;
      const subscribe = () => { sub = stompClient.subscribe(destination, m => { const r = schema.safeParse(JSON.parse(m.body)); if (r.success) cb(r.data); else logger.warn(...); }); setConnected(true); };
      const off = onStompState(state => { if (state === 'connected') subscribe(); else { sub = null; setConnected(false); } });
      if (stompClient.connected) subscribe();
      return () => { off(); sub?.unsubscribe(); };
    }, [destination, schema]);
    return connected;
  }
  ```
  Have `stompClient.ts` expose `onStompState(listener)` built on `client.onConnect`/`client.onWebSocketClose` (it already owns those callbacks at lines 33-60) instead of polling. Rebuild `useTelemetry` (keep its rAF latest-frame buffer), `useLocation`, and a new `usePlaybackStatus` on top of it; MediaController then imports the hook, not the client.

- Verified: Confirmed: the 500 ms connectivity poll plus subscribe state machine is duplicated in useTelemetry, useLocation and MediaController, although the client exposes onConnect and onWebSocketClose.

#### F037 · Medium · S1 Performance · effort M · priority 5/10

**SockJS is unnecessary for the supported browsers and drags in an unmaintained dependency plus a global shim**

- Where: `frontend/src/api/stompClient.ts:27`
- Evidence: frontend/src/api/stompClient.ts:2 `import SockJS from 'sockjs-client';` :27 `export const stompClient = new Client({` :28 `webSocketFactory: () => new SockJS(wsUrl),` :14-16 `// The SockJS handshake (GET /ws/info) bypas…
- Problem: Spring's `.withSockJS()` endpoint also serves a plain WebSocket at `/ws/websocket`; the browsers Vite targets (baseline-widely-available: Chrome 111+, Safari 16.4+, Firefox 114+) all support native WebSocket, so SockJS's fallback transports (xhr-streaming, eventsource, jsonp-polling — `jsonp-polling` and `MozWebSocket` strings are present in the built bundle) are dead weight. The library also forces the `global` define, a project-wide textual identifier replacement.
- Impact: Removes ~40 kB minified / ~13 kB gz from the authenticated bundle, one extra HTTP round-trip (`GET /ws/info`) before every STOMP connect and reconnect, and the rate-limit interaction the code works around with a 2 s activation delay (StompAuthHandler.tsx:10) — i.e. telemetry starts ~2 s sooner after login. Also removes the need for `define: { global: 'window' }`.
- Fix: In stompClient.ts replace `webSocketFactory: () => new SockJS(wsUrl)` with `brokerURL: wsUrl` where wsUrl is `wss://api.f1visualizer.com/ws/websocket` (dev proxy already has `ws: true` at vite.config.ts:26-31, so `ws://localhost:5173/ws/websocket` works locally). Remove `sockjs-client`, `@types/sockjs-client`, and the `define` block. Keep `.withSockJS()` on the backend (harmless) or switch to `.addEndpoint("/ws")` only. Remove the `GET /ws/info` mention from nginx.conf:18-20 and the 2 s `ACTIVATION_DELAY_MS` can then be re-evaluated.
- Risk: Requires the gateway to forward /ws/websocket; keep SockJS until verified in dev.
- Verified: Confirmed: sockjs-client 1.6.1 (2022) is the last release and forces define global: window across the bundle. Spring's SockJS endpoint also serves a raw WebSocket at /ws/websocket; confirm the API gateway forwards that path in dev before switching.

### Theme: Per-tick and per-resize work on the dashboard (S1 Performance)

_Telemetry state lives at the root, the canvas redraws history it never trims, lap correlation reparses dates per packet, and the selected driver loses packets to a last-wins buffer._

Findings: F011, F016, F017, F031, F041, F042, F043, F040, F060, F063

#### F011 · High · S2 Fluidity · effort S · priority 9/10

**useTelemetry keeps only the last packet per frame, so the selected driver's readout is discarded on most frames**

- Where: `frontend/src/hooks/useTelemetry.ts:48`
- Evidence: src/hooks/useTelemetry.ts:45-51 const flushBuffer = () => { if (bufferRef.current.length > 0 && callbackRef.current) { // For UI state, we only need the absolute latest frame from the buffer const latestPacket = bufferR…
- Problem: `/topic/race-data` carries every driver. The backend replay engine publishes all ~20 drivers' packets for a 250 ms window back-to-back in one tick, so they arrive on the socket within a few milliseconds — i.e. inside a single rAF interval. The flush takes only `buffer[buffer.length-1]` (one random driver) and discards the rest; the consumer then filters by `driver_number === selectedDriver.id`. The selected driver's packet reaches `setLastTelemetry` only when it happens to be the last message in the burst. 'Latest frame' semantics are correct per driver, not across drivers.
- Impact: The LIVE TELEMETRY panel (speed / RPM / gear / throttle / brake) and the derived LAP counter update sporadically or freeze for seconds while the circuit trace keeps moving, and `isInitializing` may stay true noticeably longer after 'Start Simulation'. In LIVE mode with 20 cars this is the normal case, not an edge case.
- Fix: Coalesce per driver instead of per buffer: keep a Map keyed by driver_number in the subscription callback, and on each frame forward the selected driver's latest packet (or the whole map). This also bounds the buffer to one entry per driver.
- Verified: Confirmed: /topic/race-data carries every driver; flushBuffer forwards only the last element of the buffer and RaceSimulator filters by driver afterwards. Whenever more than one packet lands between two frames, the selected driver's sample is dropped unless it happened to arrive last.

#### F016 · High · S1 Performance · effort M · priority 8/10

**Every telemetry packet re-renders the entire /dashboard tree because tick state lives at the RaceSimulator root and no child is memoized**

- Where: `frontend/src/components/RaceSimulator.tsx:88`
- Evidence: 29: const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null); 88: const { isConnected: isTelemetryConnected } = useTelemetry((data) => { 89: if (selectedDriver && data.driver_number === selectedD…
- Problem: Render tree for /dashboard is App > ThemeProvider > BrowserRouter > Auth0Provider > RequiredAuth > UserProvider > AnimatePresence > motion.div > LayoutMain > AnimatePresence > motion.div > Home > RaceSimulator. On each rAF flush with data, RaceSimulator calls setLastTelemetry (new object) and setCurrentLap (new object literal every time, line 114) and re-renders. Because nothing below it is wrapped in memo, and handleStreamStarted (130) / handleSeek (146) / the Snackbar onClose closures are new functions each render, the whole subtree reconciles per tick: SessionControlPanel with two MUI Autocompletes (each re-running renderInput/renderOption closures and sx serialization through Emotion), MediaController's Slider, DriverSelector's Autocomplete, the CircuitTrace Paper + AnimatePresence overlays + <canvas> attribute diff, both Snackbars, and ~30 fresh sx objects that Emotion must re-serialize and hash. Only the LIVE TELEMETRY Paper actually needs to change.
- Impact: On the live console the main thread reconciles hundreds of MUI/Emotion elements up to once per animation frame while the same frame also runs the 60 fps canvas loop and composites backdrop-filter blur Papers; this is where frame budget is burned on the flagship page, and it scales with packet rate, not with what changed on screen.
- Fix: Move useTelemetry + lastTelemetry/currentLap into a dedicated <LiveTelemetryPanel selectedDriver activeSession sessionLaps /> child so the per-tick setState is confined to the one Paper that displays it (RaceSimulator then never re-renders on a tick). Wrap CircuitTrace, SessionControlPanel, MediaController and DriverSelector in `memo(...)` and make handleStreamStarted/handleSeek/onClose stable with useCallback (or enable the React Compiler, see separate finding, which does this automatically). Keep the existing ref-queue design for GPS — it is already correct.
- Verified: Confirmed by reading RaceSimulator.tsx: setLastTelemetry and setCurrentLap are called at the root on every rAF flush with fresh objects, no child is memoised and the handlers are recreated each render, so the whole dashboard subtree, including the CircuitTrace wrapper, reconciles up to 60 times per second.

#### F017 · High · S1 Performance · effort M · priority 8/10

**CircuitTrace keeps unbounded history and re-projects and re-strokes every point for every driver on every frame, even when idle**

- Where: `frontend/src/components/CircuitTrace.tsx:156`
- Evidence: 39: const historyRef = useRef<Record<number, { x: number; y: number }[]>>({}); 153: if (!historyRef.current[driver_number]) { 154: historyRef.current[driver_number] = []; 155: } 156: historyRef.current[driver_number].pu…
- Problem: history is only cleared on session/reset (lines 74-81, 125-131); otherwise it grows by one heap-allocated {x,y} object per packet per driver for the whole replay. The render loop then does O(total points) lineTo calls plus two d3 scale allocations and an Object.entries every frame, and it keeps running at 60 fps when the queue is empty and when no session is active (clearRect + diagnostic text 60x/s over a page whose Papers use backdropFilter blur).
- Impact: Frame cost grows linearly through a race: a 20-driver replay accumulates hundreds of thousands of points, so the canvas loop that starts cheap ends up spending most of the frame budget on lineTo, and the trace visibly stutters late in a session. Memory also climbs monotonically (tens of MB of small objects) until the user resets.
- Fix: Cheapest first. Replace the per-frame scale objects with affine constants recomputed only when bounds change. Cache completed segments on an offscreen canvas and per frame blit it plus the 20 car dots. Cap history with a ring buffer sized to about one lap. Add a dirty flag so frames with no new packets are skipped, and stop the loop while no session is active. Move the diagnostic text out of the canvas. Consider OffscreenCanvas in a worker only if a profile still shows long frames after these land.
- Verified: Confirmed in CircuitTrace.tsx: history arrays are cleared only on reset, the loop allocates two d3 scales per frame, strokes every retained point for every driver, paints a diagnostic string every frame, and never pauses when no session is active. Frame cost therefore grows linearly through a session.

#### F031 · Medium · S2 Fluidity · effort S · priority 6/10

**No devicePixelRatio scaling: canvas backing store is CSS pixels, so the trace, glow dot and text are upscaled and blurry on HiDPI displays**

- Where: `frontend/src/components/CircuitTrace.tsx:298`
- Evidence: src/components/CircuitTrace.tsx:96-100 const observer = new ResizeObserver((entries) => { const { width } = entries[0].contentRect; if (width > 0) { setCanvasSize({ width: Math.round(width), height: Math.round(width / A…
- Problem: `width`/`height` attributes equal the CSS layout width, so on a 2x MacBook or 3x phone each canvas pixel is stretched over 4-9 device pixels. The 1.5 px ghost lines, the 4 px selected line, the 6 px car dot with `shadowBlur = 15`, and the 11 px monospace overlay are all resampled by the compositor. Every resize also goes through React state (`setCanvasSize`) which resets the 2D context state, harmless today but a trap once a transform is applied.
- Impact: The centrepiece visual looks soft/aliased on every Retina Mac and every phone, i.e. the majority of the audience for a portfolio app; it undermines the 'broadcast-quality' presentation the theme is going for.
- Fix: Size the backing store in device pixels and draw in CSS pixels via a transform, done imperatively in the ResizeObserver so no React render is needed: const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap fill cost const cssW = Math.round(width), cssH = Math.round(width / ASPECT_RATIO); canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sizeRef.current = { cssW, cssH }; and use `sizeRef.current` instead of `canvas.width/height` in the render loop (lines 186-187). Also listen for DPR changes (`matchMedia(`(resolution: ${dpr}dppx)`)`) when the window moves between monitors. Pair with the cached-layer change so the 4x pixel count does not multiply the redraw cost.
- Verified: Confirmed: the canvas width and height attributes equal the CSS layout size; there is no devicePixelRatio scaling, so lines and the glow dot are upscaled on HiDPI displays.

#### F041 · Medium · S1 Performance · effort S · priority 5/10

**Lap correlation re-filters, re-sorts and re-parses dates for every lap on every telemetry packet, then always sets a new object**

- Where: `frontend/src/components/RaceSimulator.tsx:96`
- Evidence: 95: const driverLaps = sessionLapsRef.current 96: .filter(l => l.driverNumber === data.driver_number && l.dateStart) 97: .sort((a, b) => new Date(a.dateStart!).getTime() - new Date(b.dateStart!).getTime()); 104: for (le…
- Problem: sessionLaps is fetched once per session (line 140-142) yet on every telemetry packet the callback filters all laps, sorts them with a comparator that constructs two Date objects per comparison (O(n log n) Date parses), linearly scans with more Date parses, spreads into Math.max, and finally calls setCurrentLap with a fresh object even when lapNumber has not changed — guaranteeing a re-render of the whole page (see first finding) even if lastTelemetry were reference-equal.
- Impact: Several thousand Date constructions and allocations per second of GC pressure on the hot path, and a redundant state update per tick; contributes directly to jank on the live console.
- Fix: When sessionLaps arrives, precompute once (useMemo or in the .then) a per-driver sorted array with numeric `startMs` (`Date.parse(l.dateStart)`) and `totalLaps`; in the callback do a binary search (`d3.bisector` is already in the bundle) and update with a functional setState that returns `prev` when `prev?.lapNumber === matched.lapNumber` so React bails out.
- Verified: Confirmed in RaceSimulator.tsx: on every telemetry packet the callback filters all laps, sorts them with a comparator that constructs Date objects, and calls setCurrentLap with a fresh object even when the lap is unchanged.

#### F042 · Medium · S2 Fluidity · effort S · priority 5/10

**Switching driver resets the camera bounds to Infinity without recomputing from history; the exported computeBounds() helper is unused by the component**

- Where: `frontend/src/components/CircuitTrace.tsx:84`
- Evidence: src/components/CircuitTrace.tsx:83-89 // Reset the camera bounds when the selected driver changes useEffect(() => { boundsRef.current = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }; }, [selectedD…
- Problem: After a driver change the bounds start from an empty box and grow only from packets that arrive afterwards. For the next full lap the projection domain is a tiny, expanding rectangle, so the whole already-recorded circuit (all 20 histories) is projected far outside the canvas and 'zooms out' progressively as the new driver completes the lap. `computeBounds()` in circuitProjection.ts would fix this in O(n) from the existing history, but the component reimplements projection inline, so the visual regression test (CircuitTrace.visual.test.ts) validates code that the shipped component never executes.
- Impact: Visible camera jump/zoom animation every time a user picks another driver mid-session — the most common interaction on the dashboard — and a false sense of coverage from the image-snapshot test.
- Fix: In the driver-change effect (line 84) use the helper: `boundsRef.current = computeBounds(historyRef.current, selectedDriver?.id);` and, in the render loop, replace the inline d3 scale creation (203-204) and point math with `createScales`/`projectPoint` (or an affine equivalent exported from the same module) so that CircuitTrace.visual.test.ts and the component share one code path. Better still, once the selected driver has completed a lap, freeze bounds (or use the union of all drivers' bounds) so the camera is stable regardless of selection.
- Verified: Confirmed: the driver-change effect resets bounds to Infinity without recomputing from existing history, and computeBounds in utils/circuitProjection.ts is imported only by tests.

#### F043 · Medium · S3 Enterprise · effort S · priority 5/10

**utils/circuitProjection.ts and utils/radarGeometry.ts have zero production consumers — components re-implement them and drift**

- Where: `frontend/src/components/CircuitTrace.tsx:194`
- Evidence: grep --exclude-dir=__tests__ -E 'circuitProjection|radarGeometry' src -> (no results) utils/circuitProjection.ts:15-16 export const CIRCUIT_ASPECT_RATIO = 1.6; export const CIRCUIT_PADDING = 40; CircuitTrace.tsx:31 cons…
- Problem: The `utils/` modules were extracted (and have their own tests: circuitProjection.test.ts, radarGeometry.test.ts) but the components were never switched to use them, so the test suite verifies code the application does not execute. The radar axis list now exists in three places with different casing/labels; changing the feature set for the ghost loader vs the real chart will desynchronise silently.
- Impact: False confidence from green tests; three independent geometry implementations to update when the stat model changes (e.g. adding a sixth attribute). README.md:128 advertises these utils as the shared helpers.
- Fix: Wire the utils in and delete the inline copies: in CircuitTrace.tsx replace lines 194-205 with `const { xScale, yScale } = createScales(b, width, height)` and `areBoundsValid(b)`; use `CIRCUIT_ASPECT_RATIO`. In RadarChart.tsx use `RADAR_FEATURES`, `createRadialScale(radius)`, `computeRadarPoints(driver.stats, rScale)`. In HeadToHeadLoader derive `FEATURES` from `RADAR_FEATURES.map(labelFor)` and `radarPoint` from `angleForAxis`. Add an ESLint `no-unused-modules` (eslint-plugin-import-x) rule with `unusedExports: true` so exported-but-unconsumed modules fail lint.
- Verified: Confirmed: createScales, computeBounds and the radar helpers are imported only by their tests; CircuitTrace.tsx and RadarChart.tsx re-implement the maths inline, so the tests verify code the app never runs. Lowered from high; the fix is mechanical.

#### F040 · Medium · S2 Fluidity · effort S · priority 5/10

**Live telemetry numbers re-render up to 60×/s with proportional digits, so the speed/RPM readouts jitter horizontally and reflow the panel every frame**

- Where: `frontend/src/components/RaceSimulator.tsx:303`
- Evidence: src/hooks/useTelemetry.ts:45-53 const flushBuffer = () => { if (bufferRef.current.length > 0 && callbackRef.current) { const latestPacket = ...; callbackRef.current(latestPacket); bufferRef.current = []; } animationFram…
- Problem: Each rAF flush calls `setLastTelemetry`, re-rendering the whole RaceSimulator tree (Grid, Chips, Papers, the CircuitTrace props object) up to 60 times a second. Titillium Web has proportional figures by default, so as speed moves 99→100→101 the 'KM/H' span shifts left/right every frame and the h2/h6 line boxes reflow the left column; there is no number tween, no `tabular-nums`, and no rate limiting for a value humans can only read at ~5–10 Hz. The stagger entrance (`variants`) plays once and then values hard-snap.
- Impact: The Live Telemetry panel visibly shakes during acceleration/braking — the exact moments users watch it — and the constant reflow of the left column runs concurrently with the 60 fps canvas on the right.
- Fix: 1) In the theme: `typography: { fontFamily: …, allVariants: { fontVariantNumeric: 'tabular-nums' } }` and set `minWidth: '4ch'` + `display:'inline-block'; textAlign:'right'` on the numeric spans so the unit label never moves. 2) Decouple render rate from packet rate: keep `useTelemetry`'s rAF drain but only `setLastTelemetry` when `now - lastCommit > 100` ms (10 Hz) or when `gear`/`brake > 0` changes; better, feed `speed`/`rpm`/`throttle` into framer `useMotionValue` + `useSpring(v, { stiffness: 200, damping: 30 })` and render with `<motion.span>{useTransform(spring, Math.round)}</motion.span>` so the readout glides between samples without re-rendering React at all. 3) Wrap the telemetry Paper in `React.memo` / move it into its own component so the DriverSelector, SessionControlPanel and CircuitTrace do not re-render per packet.
- Verified: Confirmed: Titillium Web uses proportional figures and the readouts re-render on every flushed frame with no tabular-nums or reserved width, so the unit label shifts as digits change.

#### F060 · Medium · S1 Performance · effort S · priority 4/10

**useLocation/useTelemetry buffers grow without bound while the tab is hidden (rAF paused, WebSocket still delivering)**

- Where: `frontend/src/hooks/useLocation.ts:46`
- Evidence: useLocation.ts:46: locationQueueRef.current.push(payload); useTelemetry.ts:31: bufferRef.current.push(payload); useTelemetry.ts:52: animationFrameId = requestAnimationFrame(flushBuffer); CircuitTrace.tsx:134: const queu…
- Problem: Both hooks push every STOMP message into a plain array that is drained only from a requestAnimationFrame callback (CircuitTrace render loop for GPS, flushBuffer for telemetry). Browsers stop firing rAF in background tabs, but the SockJS WebSocket keeps receiving. Nothing caps the arrays: with 20 drivers streaming on two topics, minutes in another tab accumulate tens of thousands of full LocationPacket/TelemetryPacket objects (7-10 fields each), and on return a single frame drains all of them into historyRef (finding above), producing a multi-hundred-ms stall.
- Impact: A user who leaves the live console open in a background tab during a replay comes back to a frozen frame and a memory spike; on low-RAM machines this is a tab-crash vector. The telemetry buffer holds every packet from every driver only to use the last one.
- Fix: Bound the queues: in useLocation keep at most e.g. 5_000 entries (drop oldest with `if (q.length > MAX) q.splice(0, q.length - MAX)`), and in useTelemetry replace the array with a `Map<number, TelemetryPacket>` keyed by driver_number (latest per driver, O(20) memory). Additionally listen for `document.visibilitychange` and either drain/clear the queue on hide or coalesce to the last point per driver while hidden.
- Verified: Confirmed: both queues are plain arrays drained only from rAF callbacks, which browsers pause in hidden tabs while the socket keeps delivering. Lowered from high because the per-driver coalescing fix bounds the telemetry side.

#### F063 · Medium · S1 Performance · effort M · priority 4/10

**LapTimeChart rebuilds the whole SVG on every resize tick and twice on mount**

- Where: `frontend/src/components/LapTimeChart.tsx:168`
- Evidence: 23: const [containerWidth, setContainerWidth] = useState(800); 32: if (width > 0) setContainerWidth(width); 42: d3.select(svgRef.current).selectAll("*").remove(); 140: svg.selectAll(".hover-dot") 141: .data(allPoints) 1…
- Problem: containerWidth starts at a hard-coded 800 and is corrected by the ResizeObserver after first paint, so mount always does two full imperative builds. Thereafter every observer callback (which fires per frame while the window is being resized or the MUI Grid reflows) sets state and the effect tears down and re-creates axes, one path per driver, the legend, the tooltip div and one hover circle with three event listeners per lap (a 20-driver race is ~1,200 circles / 3,600 listeners).
- Impact: Visible jank while resizing the Data Vault page, a double render on every session switch, and a large listener count held in the DOM for hover detection.
- Fix: Render the SVG with a fixed viewBox and let CSS scale it (no rebuild on resize), or at least `useDeferredValue(containerWidth)`/rAF-throttle the observer; measure the container in a useLayoutEffect before the first draw. Replace the per-point circles with a single `mousemove` on the svg using `d3.Delaunay.from(points).find(mx, my)` (d3-delaunay is already in the d3 bundle) or `d3.bisector` per driver. Use `.join()` instead of `selectAll('*').remove()` so unchanged nodes are patched.
- Verified: Confirmed: LapTimeChart starts at a hard-coded 800 px, is corrected by the ResizeObserver after first paint, and every observer tick tears down and rebuilds the SVG including one circle with three listeners per lap record.

### Theme: Compositing and motion discipline (S2 Fluidity)

_Blur that has no visible result, layout properties animated from JavaScript, route wrappers that mount pages twice, and no respect for reduced motion. Fixes are small and mostly mechanical._

Findings: F010, F015, F022, F029, F044, F059, F064, F083, F086

#### F010 · High · S2 Fluidity · effort S · priority 9/10

**backdrop-filter blur sits on every Paper, the AppBar and the loading overlay, over a fixed-attachment body gradient, next to a 60 fps canvas**

- Where: `frontend/src/App.tsx:54`
- Evidence: src/App.tsx:44-48 body: { background: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 100%)', backgroundAttachment: 'fixed', minHeight: '100vh' } src/App.tsx:51-57 MuiPaper: { styleOverrides: { root: { backdropFi…
- Problem: backdrop-filter forces the browser to create a backdrop root, snapshot everything behind the element, blur it, and re-run that blur whenever the element's position relative to its backdrop changes. Because the body background is `backgroundAttachment: fixed`, every scroll tick moves every Paper relative to the gradient, so every Paper's 12px blur is recomputed per scroll frame (fixed-attachment backgrounds are themselves a documented Chromium scroll-repaint trigger). All 15 Papers override the translucent theme colour with an opaque #1e1e1e / #1a1a1a, so the blurred backdrop is fully covered and never visible. The AppBar blur(20px) is the only blur the user can actually see, and it sits on a sticky element that re-samples the whole scrolled page every frame. The dashboard also runs a 60 fps <canvas> (CircuitTrace.tsx:258 requestAnimationFrame(render)) on the same page, competing for the same raster budget.
- Impact: Scroll jank and elevated GPU/raster time on every authenticated page, worst on the Live Console where the trace canvas already consumes frame budget; on Intel/low-end GPUs and Safari this shows as stuttering scroll and dropped canvas frames. Users pay this cost for an effect they cannot see.
- Fix: Remove backdropFilter from the MuiPaper override (no Paper is translucent) and from the loading overlay (use an opaque rgba(0,0,0,0.85) background instead). Keep the AppBar blur only if the bar stays translucent; otherwise make it opaque. Replace the fixed-attachment body gradient with a static fixed-position pseudo-element so scrolling never re-rasterises the gradient.
- Risk: An opaque AppBar loses its glass look. The Papers change nothing visually because they are already opaque.
- Verified: Confirmed: the theme applies blur(12px) to every MuiPaper and blur(20px) to the AppBar; all 15 Paper instances in src set an opaque bgcolor, so the Paper blur has no visible result. The body gradient uses backgroundAttachment: fixed, and CircuitTraceLoadingOverlay adds blur(4px) directly over the canvas that repaints every frame.

#### F015 · High · S2 Fluidity · effort S · priority 8/10

**prefers-reduced-motion is honoured only by the splash timer; every infinite loop, the Landing page and MUI transitions ignore it**

- Where: `frontend/src/components/splash/useSplashSequence.ts:29`
- Evidence: src/components/splash/useSplashSequence.ts:29-31 const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; src/components/splash/useSplashSequence.ts:35…
- Problem: The only reduced-motion handling shortens the splash timer, but the splash still mounts SplashBackground (two infinite full-viewport loops) and, because the phase jumps to 'hold', SplashCircuit immediately starts its infinite orbit. The Landing page (`<SplashCircuit continuous />`, pulsing glow, gradient sweep), all three loaders, both canvas overlays and the ErrorBoundary pulse never consult the preference. The matchMedia check runs once at module evaluation, so toggling the OS setting while the tab is open has no effect. framer-motion 13.2 ships `MotionConfig reducedMotion="user"` and `useReducedMotion()` (both exported from node_modules/framer-motion/dist/es/index.mjs) and neither is used. MUI's own transitions (Autocomplete popper Grow, Dialog Fade, Slider thumb, Button ripple) also run unconditionally.
- Impact: Users with vestibular disorders or 'Reduce motion' enabled (a default on many corporate/managed macOS and iOS builds) get a perpetually animating landing page and loaders; this is a WCAG 2.3.3 / enterprise-accessibility checklist failure and it also blocks battery-saver users from opting out of ~35 concurrent loops.
- Fix: Wrap the app once in <MotionConfig reducedMotion="user"> and set motion: { reducedMotion: 'user' } in createTheme. For the infinite loops (glow pulse, gradient sweep, orbiting dot, loaders, idle overlay) branch on useReducedMotion() to a static end state. Replace the module-level matchMedia constant with a hook so the preference is read at render time and in tests.
- Verified: Confirmed by grep: a single reduced-motion reference in src, evaluated once as a module constant in useSplashSequence.ts. Roughly 35 infinite framer loops, the Landing page and all MUI transitions ignore the preference. MUI 9 exposes theme.motion.reducedMotion and framer-motion 13 exports MotionConfig and useReducedMotion, both verified in node_modules.

#### F022 · High · S2 Fluidity · effort S · priority 7/10

**Route transitions use AnimatePresence mode="wait": pages mount 250 ms late, the exiting wrapper renders the new route, and every route loses its state**

- Where: `frontend/src/components/layout/LayoutMain.tsx:73`
- Evidence: src/components/layout/LayoutMain.tsx:73-83 <AnimatePresence mode="wait"> <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ dur…
- Problem: AnimatePresence keeps the previous React element (`<motion.div key="/dashboard"><Outlet/></motion.div>`) mounted for the 250 ms exit. `<Outlet />` carries no props and reads RouteContext at render time, so when the router context updates the *exiting* wrapper renders the NEW matched route (this is the documented react-router + AnimatePresence pitfall that `useOutlet()` exists to solve). Net effect per navigation: the new page mounts inside the exiting div (its effects fire: fetchSessions, fetchYears, STOMP polling), slides up and fades out, the container is empty for a frame (`mode="wait"`), then the new page mounts *again* in the entering div and re-runs the same effects. Meanwhile animating `y` on the wrapper promotes the entire page (all Papers, the canvas, the D3 SVG) into one compositing layer; combined with the AppBar backdrop blur re-sampling that moving layer every frame. Because /dashboard forces `minHeight: 100vh` and the other routes do not, the vertical scrollbar appears/disappears mid-transition, shifting content horizontally.
- Impact: Visible double-flash and content jump on every nav click, duplicated API calls and STOMP subscribe/unsubscribe churn on each navigation (the 429 rate limiter the code already works around in App.tsx:120-122 is made more likely), and a 250 ms dead window before the target route's data fetch actually starts.
- Fix: Capture the outlet element once with useOutlet() and render that inside the keyed wrapper, or switch to mode='popLayout' so the incoming route mounts immediately. The idiomatic React Router 7 option is viewTransition on the nav links with the fade expressed in CSS view-transition pseudo-elements, which removes the wrapper entirely. Persist page selections in URL search params so back and forward restore state.
- Verified: Confirmed at LayoutMain.tsx:73-83: AnimatePresence mode='wait' with the wrapper keyed on location.pathname and a prop-less <Outlet />, which is the documented react-router plus AnimatePresence pitfall that useOutlet exists to solve. The new page's data fetching cannot start until the exit animation ends.

#### F029 · Medium · S2 Fluidity · effort S · priority 6/10

**StatComparisonBar and HeadToHeadLoader animate `width` (layout property) — 10 simultaneous layout-thrashing tweens on the real page, and 10 *infinite* ones on the loader**

- Where: `frontend/src/components/versus/StatComparisonBar.tsx:55`
- Evidence: src/components/versus/StatComparisonBar.tsx:53-65 <Box sx={{ display: 'flex', height: 10, borderRadius: 1, overflow: 'hidden', bgcolor: '#333' }}> <motion.div initial={{ width: 0 }} animate={{ width: `${percentageA}%` }…
- Problem: `width` is not in motion-dom 13.2's accelerated set, so framer-motion drives it from a JS rAF loop, writing `style.width` on 10 flex children each frame; every write invalidates the flex row's layout (and, because the two bars are flex siblings sharing one row, each other's geometry) and repaints. On the loader the same 10 tweens run forever (`repeat: Infinity`) alongside 20 other infinite animations in the same file (grep: 20 `repeat: Infinity` in HeadToHeadLoader.tsx), so the Versus page is in continuous layout for its whole loading state. The bars are inside a 10 px-tall `overflow: hidden` track, so transform-based scaling is visually identical.
- Impact: Frame drops on the Head-to-Head page precisely during its signature reveal (10 concurrent layout tweens for 1.2 s) and sustained CPU/battery burn while the ghost loader is visible; on mobile the loader visibly stutters against the also-infinite radar pathLength tweens.
- Fix:

  Use a transform with an origin, which is WAAPI-accelerated and never touches layout:
  ```tsx
  <Box sx={{ position: 'relative', height: 10, borderRadius: 1, overflow: 'hidden', bgcolor: '#333' }}>
    <motion.div style={{ position:'absolute', inset:0, width:`${percentageA}%`, transformOrigin:'left', backgroundColor: driverA.teamColor }}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.65, 0.3, 0.9] }} />
    <motion.div style={{ position:'absolute', inset:0, left:`${percentageA}%`, transformOrigin:'right', backgroundColor: driverB.teamColor }}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.65, 0.3, 0.9] }} />
  </Box>
  ```
  When the driver changes, animate `left`/`width` via `layout` is unnecessary — set the static widths from props and let `scaleX` re-run with `key={`${driverA.id}-${driverB.id}`}`. Apply the same pattern to HeadToHeadLoader.tsx:481-506, and gate the loader's infinite loops behind `useReducedMotion()`.

- Verified: Confirmed: StatComparisonBar animates width, and HeadToHeadLoader runs ten infinite width tweens; width is a layout property that framer-motion drives from JavaScript each frame. Lowered from high because it affects one page.

#### F044 · Medium · S2 Fluidity · effort S · priority 5/10

**Versus loads through a serial waterfall, selects drivers pessimistically, and swaps the loader for content with a hard cut**

- Where: `frontend/src/pages/VersusMode.tsx:45`
- Evidence: src/pages/VersusMode.tsx:43-46 if (data.length > 1) { // Safely await the dynamic stat fetches await handleDriverSelect(data[0], 'A'); await handleDriverSelect(data[1], 'B'); } src/pages/VersusMode.tsx:22-26 try { const…
- Problem: Initial render needs three sequential round-trips (drivers, then stats for A, then stats for B) although the two stats calls are independent. On user interaction, the Autocomplete is controlled by driverA, which is only updated after the stats request resolves, so the dropdown visibly snaps back to the previous driver until the network returns; there is no pending indicator on the Paper/RadarChart. Because there is no sequence id or AbortController, picking A then quickly picking another A can resolve out of order and leave the older driver displayed. fetchDriverStats is uncached, so toggling back to a previously compared driver refetches.
- Impact: Head-to-Head feels laggy on every selection (the control appears to ignore the click) and takes roughly 3x the necessary time to appear after the 7 s splash. Out-of-order resolution produces visibly wrong comparisons.
- Fix: Initial load: `const [statsA, statsB] = await Promise.all([fetchDriverStats(a.id), fetchDriverStats(b.id)])`. Selection: set the driver immediately with its static stats, then merge the dynamic stats when they arrive; with React 19 use `const [optimisticA, setOptimisticA] = useOptimistic(driverA)` + `startTransition(async () => { ... })` so the selector updates instantly and reverts on rejection. Guard staleness with a per-slot `useRef<number>` request counter (or AbortController passed as `{ signal }` to apiClient.get) and add a per-driver stats cache (Map<number, Promise<Stats>>) in referenceApi.ts.
- Verified: Confirmed: VersusMode awaits the two independent stats requests sequentially, updates the selector only after the network returns, and swaps loader for content with no transition.

#### F059 · Medium · S3 Enterprise · effort M · priority 4/10

**No motion design tokens: 14 distinct durations and 8 easings are scattered across components, and MUI's own transition system is left at defaults, so the app has three uncoordinated timing vocabularies**

- Where: `frontend/src/App.tsx:19`
- Evidence: grep -rhoE 'duration: [0-9.]+' src | sort | uniq -c → 19×2, 14×0.5, 10×2.5, 8×0.3, 5×0.25, 4×1.2, 3×3, 3×0.6, 3×0.4, 2×0.2, 1×6, 1×4, 1×1.5, 1×0.35 grep -rhoE "ease: (...)" src → 26×'easeInOut', 10×'easeOut', 5×[0.25,0.…
- Problem: Entrance fades are variously 0.2, 0.25, 0.3, 0.35, 0.4, 0.5 and 0.6 s with 'easeOut', 'easeInOut', a Material curve and a custom quartic; the same 'cycling status message' pattern is 0.2 s in SplashProgress.tsx:90 but 0.25 s in DataVaultLoader.tsx:279 / HeadToHeadLoader.tsx:559 / CircuitTraceLoadingOverlay.tsx:146; the same title reveal uses `delayChildren: 1.6` in SplashScreen.tsx:17 and `0.5` in Landing.tsx:16. MUI components (Autocomplete Grow 225/195 ms, Dialog Fade, Slider, Button) use `theme.transitions` defaults that were never aligned with the framer values, and a third vocabulary lives in raw `sx` transition strings. Nothing prevents the next contributor from adding a 15th duration.
- Impact: The UI feels 'busy' rather than authored — adjacent elements settle at different speeds — and every motion tweak is a multi-file hunt. For an enterprise codebase this is the difference between a design system and a pile of effects.
- Fix:

  Create `src/theme/motion.ts` as the single source of truth and feed both systems from it:
  ```ts
  export const DUR = { fast: 0.15, base: 0.25, slow: 0.45, reveal: 0.6 } as const;
  export const EASE = { out: [0.2, 0.65, 0.3, 0.9], inOut: [0.4, 0, 0.2, 1], in: [0.4, 0, 1, 1] } as const;
  export const SPRING = { snappy: { type: 'spring', stiffness: 500, damping: 35 } } as const;
  export const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: DUR.base, ease: EASE.out } };
  ```
  Then `createTheme({ transitions: { duration: { shortest: DUR.fast*1000, shorter: DUR.base*1000, standard: DUR.slow*1000 }, easing: { easeOut: `cubic-bezier(${EASE.out})`, easeInOut: `cubic-bezier(${EASE.inOut})` } } })` and `<MotionConfig transition={{ duration: DUR.base, ease: EASE.out }}>` so unlabelled framer transitions inherit the token. Replace inline values with `{...fadeUp}` spreads; add an ESLint `no-restricted-syntax` rule on object literals named `transition` containing numeric `duration` outside `src/theme/`.

- Verified: Confirmed: durations range across 0.2 to 0.6 s with several easings and no shared constants; MUI transitions run on their own defaults.

#### F064 · Medium · S2 Fluidity · effort M · priority 4/10

**The D3 charts have no transitions and the radar is rebuilt imperatively while a declarative version already exists in the loader**

- Where: `frontend/src/components/versus/RadarChart.tsx:17`
- Evidence: src/components/versus/RadarChart.tsx:16-17 // Clear previous d3.select(svgRef.current).selectAll("*").remove(); src/components/versus/RadarChart.tsx:91-97 svg.append("path").datum(coordinates).attr("d", line).style("str…
- Problem: Neither chart uses `selection.transition()` or the enter/update/exit join, so changing Driver A on the Versus page destroys the polygon and draws a new one in one frame — the one moment where a radar chart is most expressive (shape morphing between drivers) is a hard cut, while the sibling StatComparisonBar *does* tween. LapTimeChart rebuilds all axes, N driver paths and every hover circle (one per lap record — 20 drivers × ~60 laps ≈ 1,200 DOM nodes) synchronously inside the ResizeObserver callback on every width change with no rAF/debounce, so window resizing or the drawer/scrollbar appearing (see route-transition finding) re-creates ~1,200 nodes per resize event. The tooltip toggles opacity with no transition and is repositioned via `left`/`top` on every mousemove (layout properties) instead of `transform`.
- Impact: The Head-to-Head and Data Vault pages — the two 'analysis' surfaces — feel static and abrupt compared with the heavily animated loaders that precede them; resize jank on the lap chart is visible on any window drag.
- Fix: RadarChart: keep the `<g>` and use a keyed join with a tween — `svg.selectAll('path.blob').data([driverA, driverB], d => d.id).join(enter => enter.append('path').attr('d', line(closed(d))).attr('opacity',0).call(e => e.transition().duration(400).attr('opacity',1)), update => update.transition().duration(500).ease(d3.easeCubicOut).attrTween('d', function(d){ const prev = d3.select(this).attr('d'); return d3.interpolatePath ? d3.interpolatePath(prev, line(closed(d))) : () => line(closed(d)); }).style('stroke', d => d.teamColor).style('fill', d => d.teamColor))`. Both polygons have exactly 6 points, so plain `d3.interpolateString` on `d` also morphs correctly with no extra dependency. Alternatively render the polygon as `<motion.path d={...}>` — framer-motion 13 interpolates `d` with equal command counts. LapTimeChart: (a) on first data draw, add `stroke-dasharray/offset` draw-in via `path.transition().duration(600).attrTween('stroke-dashoffset', …)` so the chart 'draws' like the ghost loader; (b) throttle the ResizeObserver with `requestAnimationFrame` and only rebuild scales/axes, using `path.attr('d', line)` on the existing selection; (c) replace the 1,200 hover circles with a single `d3.pointer` + `d3.bisector` lookup on `svg.on('pointermove')` and position the tooltip with `style('transform', `translate(${x}px, ${y}px)`)` + a 120 ms opacity transition.
- Verified: Confirmed: neither D3 chart uses transitions or a keyed join, so driver changes hard-cut; the ghost loader already draws the same radar declaratively.

#### F083 · Low · S2 Fluidity · effort S · priority 3/10

**Height-to-'auto' AnimatePresence collapses drive layout of the whole left column each frame and the MediaController toggles run alongside a sibling 'height: 0' Cancel button — two layout tweens stacked**

- Where: `frontend/src/components/RaceSimulator.tsx:220`
- Evidence: src/components/RaceSimulator.tsx:216-227 <AnimatePresence> {activeSession?.mode === 'SIMULATION' && ( <motion.div key="media-controller" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit=…
- Problem: Both `height: 'auto'` tweens are JS-driven layout animations (height is not WAAPI-accelerated) inside a `gap: 3` flex column; on Start Simulation they fire simultaneously with different durations (0.25 s and 0.35 s) and different starting offsets, so the Driver Selector and Telemetry Papers below get two overlapping push-downs and settle twice. The MediaController Paper has `overflow` unset on the animating wrapper, so during the collapse its `borderTop: '2px solid #e10600'` and slider bleed outside the shrinking box.
- Impact: A visible double-bounce of the left column every time a simulation starts or is cancelled, and clipped/bleeding content during the exit.
- Fix: Give the wrappers `style={{ overflow: 'hidden' }}`, unify both to the `DUR.base` token, and stagger them intentionally (`delay: DUR.fast` on the MediaController) so the column pushes down once. If the layout cost matters on low-end devices, use `layout` on the column container with `LayoutGroup` so framer computes a single FLIP transform for the siblings instead of per-frame height layout, or reserve the MediaController's height with `minHeight` and animate only `opacity`/`y` (compositor-only).
- Verified: Confirmed: two height-to-auto tweens with different durations run simultaneously in the left column.

#### F086 · Low · S1 Performance · effort M · priority 3/10

**framer-motion is bundled eagerly as `motion` (130 kB); `LazyMotion` + `m` with `domMax` is available in 13.2 but unused**

- Where: `frontend/src/App.tsx:5`
- Evidence: frontend/src/App.tsx:5 `import { AnimatePresence, motion } from 'framer-motion';` (same `motion` import in 19 other files: Landing.tsx:2, LayoutMain.tsx:4, HeadToHeadLoader.tsx:2, …). frontend/src/components/layout/Layo…
- Problem: `motion.*` components statically pull the full feature set (layout projection, drag, gestures) into the entry chunk. framer-motion 13 supports `<LazyMotion features={() => import('./motionFeatures')}>` with `m.div`, which keeps only ~5 kB gz of core in the entry and loads the rest in parallel. Because the app uses `layoutId`/`layout`, the feature set must be `domMax` (not the smaller `domAnimation`).
- Impact: Roughly 25-30 kB gz can move out of the critical entry chunk. Honest caveat: the Landing page starts animating immediately, so with an async feature import the first letter-stagger waits one extra request — the win is mostly for the authenticated routes and for cache stability, and is secondary to the compression/chunking findings above.
- Fix: Create `src/motionFeatures.ts` exporting `domMax` from 'framer-motion'; wrap the tree in App.tsx with `<LazyMotion features={() => import('./motionFeatures').then(m => m.default)} strict>`; replace `motion.` with `m.` across the 20 files (`import { m, AnimatePresence, LayoutGroup } from 'framer-motion'`). Keep `useMotionValue`/`animate` imports as they are (core). Do this after the chunking change so the `motion` group is a separately cached chunk either way.
- Verified: Confirmed: motion.* is imported statically everywhere and LazyMotion with domMax is exported by the installed framer-motion 13.2.

### Theme: Auth and request resilience (S3 Enterprise)

_Silent-auth defaults that depend on third-party cookies, swallowed token failures, retries on POSTs, no timeouts, no cancellation, blind casts at the boundary, and a home-grown cache with no invalidation._

Findings: F013, F019, F020, F021, F034, F035, F036

#### F013 · High · S3 Enterprise · effort M · priority 8/10

**Token acquisition failures are swallowed: requests go out without a bearer and the resulting 401s are only logged**

- Where: `frontend/src/auth/AuthHandler.tsx:13`
- Evidence: src/auth/AuthHandler.tsx:11-17: ``` try { const token = await getAccessTokenSilently(); config.headers.Authorization = `Bearer ${token}`; } catch (error) { console.error("Failed to acquire Auth0 access token", error); }…
- Problem: When `getAccessTokenSilently()` rejects (`login_required`, `consent_required`, `missing_refresh_token`, timeout), the interceptor logs and lets the request through with no bearer token. The backend answers 401; the response interceptor has a dedicated branch for 401 that does nothing but warn. `isAuthenticated` stays `true` (auth0-react does not flip it on a token failure), so `RequiredAuth` keeps rendering the app. Every data hook (`UserContext.tsx:27`, `referenceApi.ts`, `HistoricalData.tsx`) then fails independently and shows generic error states.
- Impact: Users see 'service_unavailable' / empty tables with no way to recover except a manual reload, and support cannot distinguish an expired session from an outage. From a hardening view, the client keeps issuing credential-less requests to authenticated endpoints instead of failing closed and re-authenticating.
- Fix:

  Fail closed and re-authenticate on the two Auth0 error codes that mean 'interactive login needed':
  ```ts
  // AuthHandler.tsx
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
  const location = useLocation();
  ...
  try {
      const token = await getAccessTokenSilently();
      config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
      const code = (e as { error?: string }).error;
      if (code === 'login_required' || code === 'consent_required' || code === 'missing_refresh_token') {
          await loginWithRedirect({ appState: { returnTo: location.pathname + location.search } });
      }
      return Promise.reject(new axios.Cancel('auth-required'));
  }
  ```
  and in `apiClient.ts` treat a 401 as terminal for that request (`config._authRetried` guard, one retry with a fresh token via `getAccessTokenSilently({ cacheMode: 'off' })`, then surface an `AuthExpiredError` that `RequiredAuth` maps to `loginWithRedirect`).

- Verified: Confirmed in AuthHandler.tsx, where the catch logs and lets the request proceed without a bearer, and in apiClient.ts, where the 401 branch only warns. isAuthenticated stays true, so the app keeps rendering while every request fails.

#### F019 · High · S3 Enterprise · effort M · priority 7/10

**Auth0Provider runs on library defaults (memory cache, no refresh tokens) against a shared *.auth0.com domain, so silent re-auth depends on third-party cookies**

- Where: `frontend/src/App.tsx:210`
- Evidence: src/App.tsx:210-218: ``` <Auth0Provider domain={domain} clientId={clientId} authorizationParams={{ redirect_uri: window.location.origin, audience: audience }} onRedirectCallback={onRedirectCallback} > ``` .env.prod:1 `V…
- Problem: No `useRefreshTokens`, no `cacheLocation`, no `scope`. With auth0-spa-js 2.24 defaults every `getAccessTokenSilently()` cache miss (first call after page reload, and after the in-memory token expires minus the 60 s leeway) performs a hidden-iframe `/authorize?prompt=none` against `elysianarts.us.auth0.com`. That iframe needs the Auth0 session cookie to be sent as a third-party cookie from `f1visualizer.com`, which Safari (ITP), Firefox (ETP strict) and Chrome with 3PC blocking refuse. The library then throws `login_required` and neither `AuthHandler.tsx` nor `apiClient.ts` handles it (see next finding). `useRefreshTokens` is also the prerequisite for Refresh Token Rotation, which is what the Auth0 hardening guides recommend for SPAs.
- Impact: On affected browsers a page reload drops the user to the Landing page (`isAuthenticated` false), and a long session silently degrades to unauthenticated REST calls once the access token expires. Security-wise the app relies on the least-recommended SPA token flow (iframe silent auth) instead of rotating refresh tokens.
- Fix:

  ```tsx
  <Auth0Provider
      domain={domain}
      clientId={clientId}
      useRefreshTokens
      useRefreshTokensFallback={false}   // never fall back to the 3PC iframe
      cacheLocation="memory"            // keep default; do NOT use localstorage (XSS-readable)
      authorizationParams={{
          redirect_uri: window.location.origin,
          audience,
          scope: 'openid profile email offline_access',
      }}
      onRedirectCallback={onRedirectCallback}
  >
  ```
  In the Auth0 dashboard enable *Refresh Token Rotation* + *Absolute Lifetime* on the SPA application and tick *Allow Offline Access* on the API. Longer term, put the tenant behind a custom domain (`auth.f1visualizer.com`) so the session cookie becomes first-party and `checkSession()` works everywhere.

- Risk: Requires Refresh Token Rotation and the offline_access scope to be enabled on the Auth0 tenant and API. Test the reload path in Safari and in Chrome with third-party cookies blocked.
- Verified: Confirmed: Auth0Provider receives only domain, clientId and authorizationParams; no useRefreshTokens, cacheLocation or scope. With auth0-spa-js 2.24 defaults, silent renewal uses a hidden iframe that depends on third-party cookies, which Safari and Chrome increasingly block. A related finding proposed cacheLocation: 'localstorage' to speed up token access; that advice was rejected because it makes tokens readable to any script injection. Keep tokens in memory and use refresh tokens instead.

#### F020 · High · S3 Enterprise · effort M · priority 7/10

**Axios retry policy retries non-idempotent POSTs, mis-parses Retry-After, has no jitter and ignores 502/503/504**

- Where: `frontend/src/api/apiClient.ts:47`
- Evidence: apiClient.ts:32-41 if (error.response?.status === 429 && config && (config._retryCount ?? 0) < 3) { config._retryCount = (config._retryCount ?? 0) + 1; const retryAfter = error.response.headers['retry-after']; const del…
- Problem: (1) The network-error branch never checks `config.method`, so `POST /ingestion/command`, `/playback/play|pause|seek` and `PUT /users/me/preferences` are re-sent up to 3 times. `ERR_NETWORK` also covers cases where the request reached the server but the response was lost (LB reset, CORS failure on the response), so a replay command can be executed twice. (2) `Retry-After` may be an HTTP-date per RFC 9110; `parseInt('Wed, 21 Oct ...', 10)` is `NaN`, `NaN * 1000` passed to `setTimeout` fires immediately, and a large delta-seconds value is not capped. (3) No jitter on either path, so every tab that got a 429 at the same second retries at exactly +2 s/+4 s/+8 s together (stompClient.ts has a `jitter()` helper; apiClient does not). (4) The two counters are independent (up to 7 attempts) and Cloud Run cold-start responses surfaced by API Gateway as 502/503/504 are never retried, so the most common transient failure for this stack fails on the first try.
- Impact: Duplicate 'start simulation' or 'seek' commands restart the backend replay mid-race for every viewer of that session; an immediate retry on an HTTP-date Retry-After defeats the rate limiter; a fleet-wide synchronized retry re-triggers the gateway 429; cold-start 503s show up to users as 'SIMULATION FAILED' or empty selectors.
- Fix:

  Replace the ad-hoc interceptor with axios-retry (1.x compatible) or a policy object:
  ```ts
  const IDEMPOTENT = new Set(['get','head','options','put','delete']);
  const RETRYABLE = new Set([429, 502, 503, 504]);
  function retryAfterMs(h?: string): number | undefined {
    if (!h) return undefined;
    const secs = Number(h); if (Number.isFinite(secs)) return Math.min(secs * 1000, 30_000);
    const date = Date.parse(h); return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 30_000)) : undefined;
  }
  apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
    const cfg = error.config as RetryConfig | undefined; if (!cfg) throw error;
    const status = error.response?.status;
    const transient = (status && RETRYABLE.has(status)) || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    const safe = IDEMPOTENT.has((cfg.method ?? 'get').toLowerCase()) || cfg.idempotent === true;
    cfg._attempt = (cfg._attempt ?? 0) + 1;
    if (!transient || !safe || cfg._attempt > 3 || cfg.signal?.aborted) throw error;
    const base = retryAfterMs(error.response?.headers['retry-after']) ?? 500 * 2 ** cfg._attempt;
    await new Promise(r => setTimeout(r, base * (0.5 + Math.random())));  // full jitter
    return apiClient(cfg);
  });
  ```
  For ingestion commands add an `Idempotency-Key` header (UUID per user action) so a deliberate retry is safe, then pass `{ idempotent: true }` on those calls.

- Verified: Confirmed: the ERR_NETWORK branch in apiClient.ts never checks config.method, so ingestion POSTs and the preferences PUT can be replayed up to three times; Retry-After is parsed with parseInt, which yields NaN for an HTTP-date value.

#### F021 · High · S3 Enterprise · effort M · priority 7/10

**No request timeout and no cancellation on any request; abandoned requests keep retrying**

- Where: `frontend/src/api/apiClient.ts:13`
- Evidence: apiClient.ts:13-18 export const apiClient = axios.create({ baseURL: targetBaseUrl, headers: { 'Content-Type': 'application/json', }, }); grep -rn 'AbortController\|signal\|timeout' src (non-test): 0 code hits (only comm…
- Problem: `axios.create` is called without `timeout`, so a request to a hung Cloud Run instance or a black-holed connection waits until the OS/LB gives up (the frontend LB in infrastructure/modules/lb-frontend has no explicit timeout; the API path can sit for 30-60 s). Nothing uses `AbortController`/`signal`, so unmounting a page (route change, cancel simulation) does not cancel in-flight requests, and `handleStreamStarted` re-fetches laps per session without guarding against an older session's response arriving after a newer one.
- Impact: For a live-telemetry console the UX failure is a frozen spinner: `isLoadingYears` stays true, VersusMode shows the HeadToHeadLoader forever, 'INITIALIZING...' never resolves, and the retry interceptor cannot even engage because no error is ever raised. Out-of-order `fetchSessionLaps` responses can attach a previous race's lap table to the current session, producing wrong 'LAP n/N' readouts.
- Fix:

  ```ts
  export const apiClient = axios.create({ baseURL, timeout: 15_000, timeoutErrorMessage: 'API timeout' });
  ```
  Thread an `AbortSignal` through every API function (`apiClient.get(url, { signal })`) and create one per effect:
  ```ts
  useEffect(() => {
    const ac = new AbortController();
    fetchYears(ac.signal).then(...).catch(e => { if (!axios.isCancel(e)) setError(e); });
    return () => ac.abort();
  }, []);
  ```
  In `handleStreamStarted` keep a `lapsAbortRef` and abort the previous fetch before starting the new one. Treat `ECONNABORTED` as transient in the retry policy so a timed-out GET is retried once with the same budget (`AbortSignal.any([signal, AbortSignal.timeout(15_000)])` is available in all evergreen browsers).

- Verified: Confirmed: axios.create is called without a timeout and grep finds no AbortController or signal anywhere in src. Effects only guard setState with an isMounted flag, so abandoned requests keep running and, through the interceptor, keep retrying.

#### F034 · Medium · S3 Enterprise · effort M · priority 5/10

**No runtime validation at the REST or WebSocket boundary — every response is a blind cast**

- Where: `frontend/src/api/referenceApi.ts:63`
- Evidence: referenceApi.ts:63-66 driversInflight = apiClient.get('/analysis/drivers').then(res => { driversCache = res.data; driversInflight = null; return res.data as DriverProfile[]; referenceApi.ts:82 const raceOnly = (res.data…
- Problem: `res.data` is `any` from axios, so `driversCache = res.data` and the `as` casts assert types the compiler never checks; `JSON.parse` returns `any` and is annotated as `TelemetryPacket` with no check. Only useLocation has a hand-rolled partial guard (three fields, still no type check on x/y). `types/telemetry.ts` documents wire format by comment (`// Matches JSON wire format`) rather than by contract. A backend rename (e.g. `driver_number` -> `driverNumber`, or `teamColour` losing its '#'-less convention at referenceApi.ts:30) will pass `tsc -b`, pass all 188 tests (which mock the API), and fail only in production as NaN coordinates or an empty radar. Note: zod 4.3.6 is already in node_modules but only as a transitive dependency of eslint-plugin-react-hooks — it is not importable from app code without being declared.
- Impact: Contract drift between the Spring services and the SPA is undetectable before deploy; the 60 fps canvas will happily draw garbage or silently skip every packet (CircuitTrace.tsx:149-151 discards non-numeric x/y with no signal to the user).
- Fix:

  Add `zod` (or `valibot` if bundle size matters — ~1 kB vs ~13 kB gz) as a direct dependency and create `src/api/schemas.ts`:
  ```ts
  export const TelemetryPacket = z.object({ session_key: z.number(), meeting_key: z.number(), date: z.string(), driver_number: z.number(), speed: z.number(), rpm: z.number(), gear: z.number(), throttle: z.number(), brake: z.number(), drs: z.number() });
  export type TelemetryPacket = z.infer<typeof TelemetryPacket>;
  export const DriverProfile = z.object({ id: z.number(), code: z.string(), ... });
  ```
  Replace `return res.data as DriverProfile[]` with `return DriverProfile.array().parse(res.data)`; in the STOMP hook use `schema.safeParse` and route failures to the logger. Delete the hand-written interfaces in `types/telemetry.ts` and `referenceApi.ts:4-38` in favour of `z.infer`, so the schema is the single source of truth. Consider generating the schemas from the backend's OpenAPI (springdoc) in CI so drift fails the build.

- Verified: Confirmed: every axios response and every JSON.parse result is cast to its type without a runtime check; only useLocation checks three fields. Lowered from high because the wire types are documented and owned by the same team.

#### F035 · Medium · S3 Enterprise · effort L · priority 5/10

**Hand-rolled caches with three different shapes, no invalidation and no cancellation; the router's data APIs and React 19 use() are unused**

- Where: `frontend/src/api/referenceApi.ts:130`
- Evidence: src/api/referenceApi.ts:53-57 let driversCache: DriverProfile[] | null = null; let driversInflight: Promise<DriverProfile[]> | null = null; let sessionsCache: RaceSession[] | null = null; let sessionsInflight: Promise<R…
- Problem: Three different caching shapes coexist (value+inflight for drivers/sessions/years; value-only for sessionsByYear/sessionDrivers; none for laps/stats/search). The value-only helpers can double-fetch under React StrictMode's doubled effects and when two components ask for the same roster (SessionControlPanel.tsx:80 and HistoricalData.tsx:43). No entry ever expires, so a session list that grows during a race weekend is never refreshed without a hard reload; nothing is cleared on logout, so a second user on the same tab inherits the first user's cached data. There is no stale-while-revalidate, no background refetch on focus, and no per-request loading metadata, which is why every page reimplements loading/error handling by hand (and gets it wrong in VersusMode/HistoricalData).
- Impact: Inconsistent behaviour across pages, duplicated network calls on the endpoints with the most fan-out, stale reference data during live events, and cross-user data leakage on shared machines. Each new feature has to re-solve caching/loading/error/cancellation.
- Fix: Adopt TanStack Query v5 (works with React 19): wrap App in `QueryClientProvider`, define `driversQuery = { queryKey: ['drivers'], queryFn: ({signal}) => apiClient.get('/analysis/drivers', {signal}).then(r => r.data), staleTime: 5*60_000 }` etc., prefetch during the splash with `queryClient.prefetchQuery(driversQuery)`, consume with `useQuery`/`useSuspenseQuery`, and call `queryClient.clear()` in handleLogout. If you want to stay dependency-free, at least unify on one `memoPromise(key, fn)` helper (promise-keyed so both dedup and `use()` work), add `clearReferenceCache()` invoked on logout, and cache laps/stats by key.
- Verified: Confirmed: three cache shapes coexist in referenceApi.ts with no TTL, no invalidation and no logout reset; the value-only helpers can double-fetch under StrictMode. Route-level loaders and React 19 use() are unused although the stack supports both.

#### F036 · Medium · S3 Enterprise · effort S · priority 5/10

**Environment config is defined in four places and untyped; the committed VITE_API_BASE_URL is never read**

- Where: `frontend/src/App.tsx:191`
- Evidence: frontend/src/App.tsx:191-193: const domain = import.meta.env.VITE_AUTH0_DOMAIN; const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID; const audience = import.meta.env.VITE_AUTH0_AUDIENCE; frontend/src/api/apiClient.ts:…
- Problem: The Vite template's `src/vite-env.d.ts` has been deleted and nothing augments `ImportMetaEnv`, so `import.meta.env.VITE_AUTH0_DOMAIN` is typed `any` through `vite/client`'s index signature — a typo (`VITE_AUTH0_DOMIAN`) compiles and yields `undefined` at runtime, and there is no boot-time validation that the three Auth0 values are present. The prod/uat/dev origin decision is made independently in `apiClient.ts`, `stompClient.ts`, the three `.env.*` files, and the nginx `map` blocks (which the comment admits merely "mirror" the others) — five sources for one fact. There is no `.env.example` documenting the contract for a new environment, and the frontend `.gitignore:27` ignores only `.env.local` while the root `.gitignore` needs three negation rules to un-ignore what a blanket `*.env.*` blocks. Committing the files is defensible (they are public SPA config, as the comment says) but it couples an environment change to a code commit and a rebuild.
- Impact: Adding an environment (e.g. `staging`) requires touching five files in two languages and cannot be done by ops without a frontend release; a missed edit fails only at runtime with an Auth0 error or a CSP `connect-src` block. A typo in an env key is a silent `undefined`, which for Auth0 manifests as a confusing redirect loop rather than a clear config error.
- Fix: Add `src/vite-env.d.ts` with `/// <reference types="vite/client" />` and `interface ImportMetaEnv { readonly VITE_AUTH0_DOMAIN: string; readonly VITE_AUTH0_CLIENT_ID: string; readonly VITE_AUTH0_AUDIENCE: string; readonly VITE_API_BASE_URL: string }` + `interface ImportMeta { readonly env: ImportMetaEnv }`. Create `src/config/env.ts` that reads those once, asserts non-empty at module load (`throw new Error('Missing VITE_AUTH0_DOMAIN')`), derives `apiBaseUrl` and `wsUrl` from `VITE_API_BASE_URL` (retire the MODE `if` chains in apiClient/stompClient — the value already exists in `.env.*:4`), and is the only module importing `import.meta.env`. Commit a `.env.example` and reference it from README "Environment modes". Longer term, move the per-environment values out of the image entirely: emit a `config.json` from Cloud Run env vars via an nginx `sub_filter`/entrypoint template so one image serves all three environments — which also lets `nginx.conf`'s CSP map read the same source of truth.
- Verified: Confirmed: VITE_API_BASE_URL is written in every .env file and read nowhere; the API and WebSocket origins are hard-coded in two MODE ladders; there is no vite-env.d.ts, so env reads are typed any and a typo compiles to undefined.

### Theme: Failure is invisible (S3 Enterprise)

_Errors go to the console and nowhere else; pages have no error or empty states; the UI lies about connection state; a saved preference can silently fail._

Findings: F018, F023, F030, F046, F045, F062, F061, F075, F077

#### F018 · High · S3 Enterprise · effort M · priority 8/10

**No error or empty states: an analysis-service failure leaves Versus on an infinite skeleton, the Data Vault on a blank chart, and preference saves report success on failure**

- Where: `frontend/src/pages/VersusMode.tsx:61`
- Evidence: src/pages/VersusMode.tsx:38-51 const initializeDrivers = async () => { try { const data = await fetchDrivers(); if (isMounted) { setDrivers(data); if (data.length > 1) { ... } } } catch (err) { console.error("Failed to …
- Problem: The only rendering branches are 'both drivers set' or HeadToHeadLoader. A rejected fetchDrivers (after the 3 s FAILURE_COOLDOWN a fresh request would succeed, but nothing re-triggers it), a 401 after token expiry, or a response with 0-1 drivers leaves the ghost radar chart animating forever with cycling 'QUERYING CAREER STATISTICS...' captions. The catch block only logs. There is no Alert, no Retry button, and no way out except navigating away.
- Impact: Any transient API/gateway blip on the Head-to-Head page turns into a permanent, convincing-looking loading screen. Users cannot tell the difference between 'slow' and 'broken', and support cannot reproduce because nothing is shown on screen.
- Fix: Give each loader an explicit status (loading, ready, empty, error) and render an inline alert with a retry action; the referenceApi cooldown already prevents stampedes. Rethrow from handleUpdatePreferences (or return a result) so the modal's existing error path works. Consume the user-service 'service_unavailable' flag somewhere visible.
- Verified: Confirmed: VersusMode.tsx renders HeadToHeadLoader whenever either driver is missing and its catch blocks only log; HistoricalData has no error branch; UserContext.handleUpdatePreferences catches and logs, so the settings modal's failure alert is unreachable and the dialog closes as if the save succeeded.

#### F023 · High · S3 Enterprise · effort M · priority 7/10

**No error reporting sink or global error handlers; one app-wide ErrorBoundary whose retry budget never resets**

- Where: `frontend/src/components/ErrorBoundary.tsx:37`
- Evidence: ErrorBoundary.tsx:36-37 componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack); ErrorBoundary.tsx:43-51 if (this.state.retryCount < M…
- Problem: Errors are only ever written to the user's console. There is no Sentry/GCP Error Reporting client, no `window.addEventListener('error'|'unhandledrejection')`, so the majority of failures in this app, which are asynchronous (STOMP callbacks, promise rejections such as `handleSeekCommitted`, interceptor retries), are invisible to operators. The single boundary wraps every route, so a render error inside RadarChart or LapTimeChart replaces the whole app including navigation. `retryCount` is only reset by the manual RETRY button, never on a successful render, so after three lifetime catches (including StrictMode-induced ones in dev) auto-recovery is silently disabled for the rest of the session.
- Impact: Operators learn about production breakage from users, not telemetry; incident triage has no stack traces, no build id, no breadcrumb of the STOMP/HTTP events that preceded the error. A single bad payload from the analysis service can blank the entire console for every viewer, and the 'Attempting automatic recovery' path degrades unnoticed over a long session.
- Fix: Add an error reporter (Sentry or GCP Error Reporting) initialised in main.tsx with the release stamp, plus window error and unhandledrejection handlers. Nest a second boundary around <Outlet /> keyed on the location so the AppBar survives a page crash; reset retryCount after a stable render; skip auto-retry for deterministic error types.
- Verified: Confirmed: ErrorBoundary.componentDidCatch only calls console.error; there are no window error or unhandledrejection listeners; retryCount only ever increments, so three transient errors in a long session disable auto-recovery for good.

#### F030 · Medium · S2 Fluidity · effort S · priority 6/10

**RaceSimulator effects are keyed on the whole userProfile object, causing a DriverSelector unmount/remount and driver-reset cascade whenever the profile object changes**

- Where: `frontend/src/components/RaceSimulator.tsx:83`
- Evidence: 58: setIsLoadingDrivers(true); 65: const defaultDriver = data.find(d => d.code === favCode) || data[0]; 66: setSelectedDriver(defaultDriver); 83: }, [userProfile]); 187: }, [userProfile]); // handleSessionSelected Sessi…
- Problem: On dashboard mount userProfile is null, then UserContext resolves it (line 29), so the bootstrap effect runs twice: the second run flips isLoadingDrivers to true (unmounting DriverSelector for a CircularProgress) and then remounts it and overwrites selectedDriver. The same happens every time preferences are saved (UserContext line 71 stores a new object): the user's current channel is replaced by the favourite mid-session. Because handleSessionSelected also depends on [userProfile], its identity changes too, which re-triggers SessionControlPanel's effect at line 88 (fetchSessionDrivers + onSessionSelected) and resets the driver a third time.
- Impact: Visible flash of the driver selector on first load and after saving settings; a live session's tracked driver silently switches; redundant work on every profile update.
- Fix: Depend on the primitive that matters: `const favCode = userProfile?.preferences?.favoriteDriver;` and use `[favCode]` in both effects; only apply the default when `selectedDriver === null` (functional setState `prev => prev ?? defaultDriver`). Do not toggle isLoadingDrivers when data is already cached (fetchDrivers returns the cache synchronously-ish).
- Verified: Confirmed: the bootstrap effect depends on the whole userProfile object and UserContext stores a new object after every preference save, so saving preferences re-runs driver initialisation and overwrites the user's current driver selection.

#### F046 · Medium · S3 Enterprise · effort M · priority 5/10

**console.* is the entire logging strategy (41 call sites), several failures are swallowed, and nothing is gated in production**

- Where: `frontend/src/context/UserContext.tsx:68`
- Evidence: grep -c 'console\.(log|warn|error|debug|info)' src (excl. tests) -> 41 UserContext.tsx:68-75 const handleUpdatePreferences = async (newPrefs: UserPreferences) => { try { const updatedProfile = await updateUserPreference…
- Problem: Errors are logged and dropped at the layer that catches them, so the layers above cannot react: `updatePreferences` swallows, making the modal's 'Failed to save' Alert dead code and closing the dialog on failure; VersusMode swallows the drivers fetch and then renders the animated loader forever; HistoricalData drops the error and shows an empty chart. Meanwhile `debug:` logs every STOMP frame (heartbeats every 10 s, every message) to the production console, and diagnostic `console.log` lines ship in the 60 fps path. There is no level gate, no correlation id, no sink (Cloud Logging / Sentry) despite Cloud Run deployment.
- Impact: Users see a spinner or a silently closed dialog instead of an error; operators have no client-side error telemetry; production consoles are flooded (the STOMP debug output alone is several lines per second).
- Fix: 1. `src/lib/logger.ts`: `createLogger(scope)` with `debug/info/warn/error`, level from `import.meta.env.DEV ? 'debug' : 'warn'`, and a pluggable `onError` sink (wire to Sentry/GCP later). Replace all 41 `console.*` calls; set `stompClient.debug` to `logger.debug` (no-op in prod). 2. Make `handleUpdatePreferences` rethrow after logging (or return a `Result`) so UserSettingsModal's Alert works. 3. Give pages an explicit error state: `VersusMode` -> `const [status, setStatus] = useState<'loading'|'ready'|'error'>()`, render an `<ErrorState onRetry />` instead of the loader. 4. Register React 19 `createRoot(el, { onUncaughtError, onCaughtError })` in main.tsx to route render errors to the same logger.
- Verified: Confirmed by grep: 41 console call sites with no level gating or production stripping; several catch blocks swallow errors that the UI has paths for.

#### F045 · Medium · S2 Fluidity · effort S · priority 5/10

**CircuitTrace 'INITIALIZING' overlay has no timeout and only clears when telemetry for the selected driver arrives**

- Where: `frontend/src/components/RaceSimulator.tsx:92`
- Evidence: src/components/RaceSimulator.tsx:88-92 const { isConnected: isTelemetryConnected } = useTelemetry((data) => { if (selectedDriver && data.driver_number === selectedDriver.id && activeSession && data.session_key === activ…
- Problem: After START SIMULATION succeeds, the canvas is covered by a blurred overlay with a shimmer bar and cycling 'CONNECTING TO DATA FEED... / MAPPING GPS COORDINATES...' captions. The only exit condition is a telemetry packet matching both the selected driver and session key. If the driver has no telemetry in that session, the STOMP socket is down or the breaker has opened, the backend replay starts at a point before that driver's data, or the user changed driver mid-initialisation, the overlay stays up indefinitely. The overlay does not react to `connectionLost` and offers no hint that the CANCEL button in the left panel is the way out.
- Impact: A realistic and common failure (Cloud Run cold start dropping the first packets, or a retired driver) looks like an unrecoverable hang on the app's flagship feature.
- Fix: Add a watchdog in handleStreamStarted: `const t = setTimeout(() => setInitTimedOut(true), 20_000)` cleared when the first packet lands; when timed out, swap the overlay copy to 'No telemetry received for {driverCode}. Check the feed status or cancel and retry.' with an inline Cancel/Retry button. Also hide the loading overlay (or change its caption) while `connectionLost` is true, and reset the watchdog on driver change.
- Verified: Confirmed: isInitializing clears only when a telemetry packet for the selected driver and session arrives; nothing times it out.

#### F062 · Medium · S3 Enterprise · effort S · priority 4/10

**nginx has no health endpoint, unstructured access logs and no explicit Cloud Run probes**

- Where: `frontend/nginx.conf:82`
- Evidence: nginx.conf:78-83 location / { root /usr/share/nginx/html; index index.html index.htm; # Fallback to index.html for React Router try_files $uri $uri/ /index.html; } (no `location = /healthz`, no `log_format`, no `access_…
- Problem: Any path, including `/healthz` or `/ready`, is answered by the SPA shell with 200, so an uptime check 'passes' as long as index.html exists, and every probe hit produces a full-document access-log line. Cloud Run falls back to its default TCP startup probe and no liveness probe. The nginx-unprivileged image writes the default `combined` format to stdout, which Cloud Logging ingests as an opaque `textPayload`; there is no request latency, no `X-Cloud-Trace-Context`, no `$request_id`, and no way to filter probe noise.
- Impact: Cloud Monitoring uptime checks and Cloud Run health signals cannot distinguish 'nginx up but dist missing/partial' from healthy; log-based metrics for 4xx/5xx or latency on the frontend origin cannot be built without regex parsing; probe traffic inflates request counts.
- Fix:

  ```nginx
  log_format json_combined escape=json '{"time":"$time_iso8601","severity":"INFO","httpRequest":{"requestMethod":"$request_method","requestUrl":"$scheme://$host$request_uri","status":$status,"responseSize":"$body_bytes_sent","userAgent":"$http_user_agent","remoteIp":"$remote_addr","latency":"${request_time}s","referer":"$http_referer"},"logging.googleapis.com/trace":"$http_x_cloud_trace_context"}';
  access_log /dev/stdout json_combined;
  location = /healthz { access_log off; add_header Cache-Control "no-store" always; default_type text/plain; return 200 "ok\n"; }
  ```
  (Because this location declares `add_header`, either repeat the security headers or move them into a shared `include security-headers.conf;`.) In `cloud-run-frontend/main.tf` add `startup_probe { http_get { path = "/healthz" } }` and `liveness_probe { http_get { path = "/healthz" } period_seconds = 30 }`, and point a Cloud Monitoring uptime check at `https://f1visualizer.com/healthz` with content match `ok`.

- Verified: Confirmed: try_files answers any path, including /healthz, with the SPA shell and a 200; access logs use the default combined format.

#### F061 · Medium · S2 Fluidity · effort S · priority 4/10

**MediaController play/pause is pessimistic and seek has no error handling or pending state**

- Where: `frontend/src/components/MediaController.tsx:50`
- Evidence: src/components/MediaController.tsx:14 const [isPlaying, setIsPlaying] = useState(true); src/components/MediaController.tsx:50-64 const handleTogglePlay = async () => { setIsPending(true); try { if (isPlaying) { await pa…
- Problem: Pressing play/pause disables the button and swaps the icon for a spinner until the POST round-trip completes (through an API gateway to Cloud Run), so the icon does not reflect the user's intent for hundreds of ms; a failure only logs, so the UI silently stays in the old state. Seek clears the circuit trace synchronously (onSeek) *before* the request, has no try/catch (a rejected seek becomes an unhandled promise rejection and the trace stays blank), and no pending/disabled state, so a second drag while the first seek is in flight issues overlapping seek+play commands. `isPlaying` is assumed true on mount rather than read from the /topic/playback-status feed.
- Impact: The transport controls feel sluggish and occasionally wrong (icon shows Pause while the backend is actually paused after a failed request). Failed seeks leave an empty trace with no explanation.
- Fix: Use React 19 `useOptimistic`: `const [optimisticPlaying, setOptimisticPlaying] = useOptimistic(isPlaying)`; in the handler `startTransition(async () => { setOptimisticPlaying(!isPlaying); try { await (isPlaying ? pauseSimulation() : playSimulation()); setIsPlaying(!isPlaying); } catch { showSnackbar('Playback command failed'); } })` and keep the button enabled (guard re-entrancy with a ref). Wrap seek in try/catch, keep the last STOMP-reported progress in a ref to revert on failure, mark the slider `disabled` while a seek is pending, and include `playing: boolean` in the playback-status payload so isPlaying is server-derived.
- Verified: Confirmed: MediaController disables the toggle and shows a spinner until the POST round-trip completes, and seek has no try/catch.

#### F075 · Low · S1 Performance · effort S · priority 3/10

**No Web Vitals / RUM collection, so splash, bundle and live-feed frame health are unmeasured in the field**

- Where: `frontend/src/main.tsx:5`
- Evidence: main.tsx:5-9 createRoot(document.getElementById('root')!).render( <StrictMode> <App /> </StrictMode>, ) package.json dependencies: no `web-vitals`; grep -rn 'PerformanceObserver\|web-vitals\|sendBeacon' src: 0 hits useT…
- Problem: There is no LCP/INP/CLS capture and no application-specific metrics (STOMP time-to-first-packet, reconnect count, rAF frame time, location queue depth) leaving the browser. The only performance data is whatever a developer sees in local DevTools.
- Impact: The 1.15 MB single chunk and 7 s splash exist without any field evidence of their cost across devices; regressions in the 60 fps trace loop (the app's core value) are discovered by users, and the roadmap has no baseline to prove improvement against.
- Fix:

  `yarn add web-vitals` then in `main.tsx`:
  ```ts
  import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals';
  const send = (m: Metric) => navigator.sendBeacon('/api/v1/rum', JSON.stringify({ ...m, v: __APP_VERSION__, mode: import.meta.env.MODE }));
  [onLCP, onINP, onCLS, onTTFB].forEach(fn => fn(send));
  ```
  (or forward to Sentry's `browserTracingIntegration`). Add custom marks: `performance.mark('stomp:connected')`, `performance.measure('stomp:ttfp', 'session:start', 'gps:first-packet')`, and a dropped-frame counter in `useTelemetry`'s rAF loop reported once per minute. Add `/api/v1/rum` to the API Gateway openapi (or post to GA4 measurement protocol) and, per the CSP in nginx.conf:72, add the collector origin to `connect-src`.

- Verified: Confirmed: no web-vitals or custom metrics leave the browser.

#### F077 · Low · S3 Enterprise · effort S · priority 3/10

**Auth error screen is a dead end and exposes developer-oriented text and raw Auth0 error strings to end users**

- Where: `frontend/src/App.tsx:135`
- Evidence: src/App.tsx:135-143: ``` if (error) { return ( <div style={{ padding: '2rem', textAlign: 'center', color: '#ff4444', fontFamily: 'sans-serif' }}> <h2>Authentication Error</h2> <p>{error.message}</p> <p style={{ fontSize…
- Problem: `error` from `useAuth0()` is set by `handleRedirectCallback` for any `?error=...&state=...` URL, including a stale link, a browser back-navigation after login, or a crafted `/?error=access_denied&state=x` link (auth0-spa-js validates the transaction first, so the attacker-controlled `error_description` is replaced by 'Invalid state', limiting content injection). Whatever the cause, the user is stuck on an unstyled page with no button, and the copy ('Check your Auth0 Dashboard and .env configuration') is aimed at the developer. The error is never cleared because nothing calls `loginWithRedirect` again or strips the query string.
- Impact: Low security impact (React escapes `error.message`, CSP blocks scripts); real UX/support impact: a user with a stale bookmark sees a raw 'Invalid state' page and does not know to go back to `/`.
- Fix:

  Render a branded recovery screen with a retry that clears the URL:
  ```tsx
  if (error) {
      return (
          <AuthErrorScreen
              message={error.message === 'Invalid state' ? 'Your sign-in link expired.' : 'Sign-in failed.'}
              onRetry={() => { window.history.replaceState({}, '', '/'); void loginWithRedirect(); }}
          />
      );
  }
  ```
  Log `error.error` / `error.error_description` to console only under `import.meta.env.DEV`.

- Verified: Confirmed: the auth error branch renders raw error text with no retry action.

### Theme: Accessibility debt (S3 Enterprise)

_Keyboard and screen-reader users cannot operate the console today: no focus ring, an unnamed play button, focus lost on every press, a canvas and two charts with no alternative, and headings that read out telemetry numbers._

Findings: F024, F025, F051, F052, F053, F054, F067, F068, F069, F065, F070, F080, F081, F093

#### F024 · High · S3 Enterprise · effort S · priority 7/10

**Every button in the app has no visible keyboard focus indicator (MUI 9 focus ring is opt-in and not enabled)**

- Where: `frontend/src/App.tsx:19`
- Evidence: App.tsx:19-40 19 const broadcastTheme = createTheme({ 20 palette: { ... 40 shape: { borderRadius: 4 }, 41 components: { (no `focusVisible` key anywhere in the createTheme call) node_modules/@mui/material/ButtonBase/Butt…
- Problem: MUI 9 ships a 2px outline focus ring, but only when `focusVisible: true` (or an object) is passed to `createTheme`; otherwise ButtonBase keeps `outline: 0` and the only keyboard-focus cue is the low-alpha ripple pulse. The app's theme never opts in, and no component adds its own `&.Mui-focusVisible` style (the sole custom one is the Slider thumb shadow in MediaController.tsx:114). Nav links, Settings/Logout icon buttons, START/CANCEL SIMULATION, the play/pause button, the login CTA and dialog actions therefore fail WCAG 2.4.7 Focus Visible (AA) and 2.4.11 Focus Appearance.
- Impact: Keyboard-only and switch users cannot tell which of the three nav tabs, the two icon buttons, or the dialog actions currently has focus on a near-black UI; tabbing through the Race Engineer Console is effectively blind. This is the first thing an enterprise accessibility audit (or a customer's VPAT request) will fail.
- Fix: In App.tsx pass the MUI 9 opt-in: `createTheme({ focusVisible: { outlineColor: '#ffffff', outlineWidth: 2, outlineOffset: 2 }, ... })` (white gives 18:1 on the dark surfaces; the default primary #e10600 is only 3.8:1 and vanishes on the red contained buttons). ButtonBase, Slider, Autocomplete options and IconButton all consume `theme.focusVisible` automatically. Add a Vitest assertion that `broadcastTheme.focusVisible` is defined so a future theme refactor cannot silently drop it.
- Verified: Confirmed: createTheme in @mui/material 9.4 applies its focus ring only when a focusVisible option is passed (createTheme.js:95); App.tsx passes none and no component styles Mui-focusVisible except the slider thumb.

#### F025 · High · S3 Enterprise · effort S · priority 7/10

**Play/Pause control is an icon-only IconButton with no accessible name**

- Where: `frontend/src/components/MediaController.tsx:85`
- Evidence: MediaController.tsx:85-92 85 <IconButton 86 onClick={handleTogglePlay} 87 color="primary" 88 disabled={isPending} 89 sx={{ bgcolor: 'rgba(225, 6, 0, 0.1)', '&:hover': { bgcolor: 'rgba(225, 6, 0, 0.2)' } }} 90 > 91 {isPe…
- Problem: The button toggles between PauseIcon/PlayArrowIcon SVGs (`aria-hidden` by MUI) and a CircularProgress; none of them contribute an accessible name, and there is no `aria-label`, `aria-pressed`, or Tooltip. Screen readers announce it as 'button'. During `isPending` the spinner has no `aria-busy`/label either. WCAG 4.1.2 Name, Role, Value (Level A) and 1.1.1.
- Impact: The single most important control on /dashboard (start/stop the replay that drives the whole telemetry view) is unidentifiable to screen-reader users, and its current state (playing vs paused) is conveyed only by which icon is drawn.
- Fix: `<IconButton aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'} aria-pressed={isPlaying} aria-busy={isPending} ...>`; wrap in `<Tooltip title={...}>` for sighted users as LayoutMain already does. Update MediaController.test.tsx to `getByRole('button', { name: /pause simulation/i })` so the name becomes a tested contract.
- Verified: Confirmed: MediaController.tsx renders an IconButton whose only children are aria-hidden icons or a spinner, with no aria-label or tooltip.

#### F051 · Medium · S3 Enterprise · effort S · priority 5/10

**Circuit trace <canvas> has no role, name or text alternative; diagnostics are painted into pixels**

- Where: `frontend/src/components/CircuitTrace.tsx:296`
- Evidence: CircuitTrace.tsx:296-301 296 <canvas 297 ref={canvasRef} 298 width={canvasSize.width} 299 height={canvasSize.height} 300 style={{ display: 'block', width: '100%', height: 'auto' }} 301 /> CircuitTrace.tsx:255 255 ctx.fi…
- Problem: The canvas is an empty element to assistive technology: no `role="img"`, no `aria-label`, no fallback children, and the sibling caption is not linked via `aria-labelledby`/`aria-describedby`. The only textual status (packet count, drivers seen, bounds ready) is drawn with `fillText`, so it is invisible to screen readers and cannot be zoomed/reflowed. Nothing exposes the selected driver's position or the number of cars on track. WCAG 1.1.1 (A), 1.3.1.
- Impact: The centrepiece of /dashboard (8 of 12 grid columns) is a black hole for blind and low-vision users; they cannot even learn that data has started arriving. It also blocks the 'BOUNDS: WAITING' diagnostic from being readable at 200% zoom.
- Fix: `<canvas role="img" aria-labelledby="trace-title" aria-describedby="trace-caption">Circuit trace for {driverCode}: {n} cars tracked</canvas>` with `id`s on the h6 (line 269) and caption (line 316). Move the diagnostic line out of the canvas into a visually-hidden or small `<Typography component="p" aria-live="polite">` updated at most once per second from a `setInterval` reading `diagRef` (not per frame). Optionally expose a throttled sentence such as 'VER on lap 12, sector 2, 19 other cars on track' in the same polite region.
- Verified: Confirmed: the canvas has no role, name or fallback content, and the only status text is painted with fillText. Lowered from high because a text caption exists nearby.

#### F052 · Medium · S3 Enterprise · effort S · priority 5/10

**Text and chart colours below WCAG AA contrast on the dark theme (measured)**

- Where: `frontend/src/components/CircuitTraceLoadingOverlay.tsx:70`
- Evidence: CircuitTraceLoadingOverlay.tsx:70-79 (#e10600 on ~#050505 overlay = 3.36:1 on #1e1e1e; 16px bold at 375px is NOT large text) 72 fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', 73 fontWeight: 700, 75 color: '#e10600', CircuitTra…
- Problem: Computed with the WCAG formula after alpha-compositing onto the actual backgrounds: the loading/idle overlay copy, the race-info line, the Landing tagline, chart axis titles, the KM/H unit and several series colours fall below 4.5:1 (text) or 3:1 (large text / non-text UI, 1.4.11). The idle overlay's primary instruction 'SELECT A RACE AND START A SIMULATION' sits at 2.67:1 in 12px uppercase tracked text; the 8.8px status strings are below minimum legible size as well. #e10600 (primary) is used as body-size bold text on the loading overlay at 3.36:1.
- Impact: Low-vision users and anyone on a glare-heavy laptop screen cannot read the very instructions that tell them how to start a session, nor distinguish Red Bull (#0600EF) from the background on the lap chart. Fails WCAG 1.4.3/1.4.11 AA in every page of the app.
- Fix: Introduce theme tokens instead of ad-hoc alphas: `palette.text.disabled` at rgba(255,255,255,0.6) (4.6:1 on #121212) as the floor for any real copy; keep <0.3 alpha only for purely decorative ghost shapes. For red-on-dark text add `palette.primary.light: '#ff3b36'` (~4.9:1) and use it wherever #e10600 is text (CircuitTrace.tsx:269 `color="primary"` h6 is fine at 20px/600 = large; the overlay title at 16px is not). Replace `#666` axis fills with `#9a9a9a` (>=5:1) and drop the animated `opacity: 0.4` wrapper (CircuitTrace.tsx:277) in favour of a colour token. Rework FALLBACK_COLORS to a 3:1-validated set (e.g. '#3b6bff' for Red Bull, '#5c8fb8' for AlphaTauri, '#1f9e8c' for Aston) and run them through the same script used here in a unit test. Raise the smallest fontSize to 0.75rem (12px).
- Verified: Spot-checked: the loading overlay uses white at 0.35 alpha on #121212, roughly 3:1, below the 4.5:1 text minimum; the core theme palette itself passes.

#### F053 · Medium · S3 Enterprise · effort S · priority 5/10

**Buttons disable themselves while focused, dropping keyboard focus to <body> after every press**

- Where: `frontend/src/components/MediaController.tsx:88`
- Evidence: MediaController.tsx:50-51 + 88 50 const handleTogglePlay = async () => { 51 setIsPending(true); 88 disabled={isPending} SessionControlPanel.tsx:90-93 + 163 90 const handleStart = async () => { 93 setIsLoading(true); 163…
- Problem: Each async action flips `disabled` on the button that was just activated. A disabled `<button>` is removed from the tab order and, in Chromium/Firefox, loses focus immediately, so `document.activeElement` becomes `<body>`. When the request resolves the button re-enables (MediaController) or stays disabled forever (`isSessionActive` on START SIMULATION), and focus is never restored; the next Tab press starts from the top of the document. WCAG 2.4.3 Focus Order / 3.2.2 On Input.
- Impact: A keyboard user who presses Space on Play/Pause is thrown back to the start of the page after every toggle — on a control they will use dozens of times per session. Starting a simulation loses their place entirely, and the newly revealed CANCEL SIMULATION button is not focused either.
- Fix: Keep the element focusable: use `aria-disabled={isPending}` plus an early return in the handler, or MUI's `loading` prop on Button (MUI 9 `<Button loading={isLoading}>` keeps focus and adds an aria-busy spinner; for IconButton use `aria-busy`). Where a control legitimately disappears (START after success) move focus explicitly with a ref: `cancelBtnRef.current?.focus()` in an effect keyed on `isSessionActive`, or use React 19 ref callbacks with cleanup.
- Verified: Confirmed: MediaController disables the toggle while pending and the Start button stays disabled once a session is active, so keyboard focus drops to the body.

#### F054 · Medium · S3 Enterprise · effort M · priority 5/10

**/dashboard, /historical, the AppBar and the settings Dialog do not reflow at 375 px**

- Where: `frontend/src/components/layout/UserSettingsModal.tsx:82`
- Evidence: UserSettingsModal.tsx:82 82 sx: { bgcolor: '#1e1e1e', color: 'white', minWidth: 400, border: '1px solid #333' } LayoutMain.tsx:45-64 (three labelled NavButtons + two IconButtons in one non-wrapping Toolbar, no breakpoin…
- Problem: Several containers have fixed or non-responsive geometry: the settings dialog forces `minWidth: 400` (wider than a 375 px viewport, overriding MUI's `maxWidth: calc(100% - 64px)`), so the Cancel/Save actions are pushed off-screen; the AppBar keeps three text+icon nav buttons plus two icon buttons in a single non-wrapping row (~600 px of content); the Data Vault header pins a 300 px selector beside an h4 in a `justifyContent: space-between` row with no `flexWrap`; the Race Engineer Console adds 32 px padding inside a Container that already has 24 px, then puts a non-wrapping h4 + two chips in one row and four `size={3}` metric cells (about 55 px each) that cannot hold 'THROTTLE'/'100%'. The Landing page is `position: fixed; overflow: hidden` with a 5 rem title, a 60 %-width SVG and an absolutely positioned footer — in landscape phones (667x375) the login button is clipped and unreachable by scrolling. WCAG 1.4.10 Reflow (AA) and 1.4.4 Resize Text (200 % zoom on desktop hits the same breakpoints).
- Impact: Trackside/mobile use of the Live Console — the app's main pitch — is broken below ~900 px: horizontal scrolling, a dialog whose Save button cannot be reached, and a landing page whose only CTA can be clipped.
- Fix: Dialog: `fullScreen={useMediaQuery(theme.breakpoints.down('sm'))}` and `minWidth: { xs: 'auto', sm: 400 }`. AppBar: on `xs`/`sm` collapse the NavButtons to icon-only with Tooltip (`sx={{ '& .MuiButton-startIcon': { m: 0 } }}` and hide `label` via `display: { xs: 'none', md: 'inline' }`) or render a MUI `BottomNavigation`. HistoricalData header and RaceSimulator header: add `flexWrap: 'wrap', gap: 2`, and make the selector `width: { xs: '100%', sm: 300 }`. Metrics grid: `<Grid size={{ xs: 6, md: 3 }}>`. Reduce RaceSimulator outer padding to `p: { xs: 1, md: 4 }` and drop `minHeight: '100vh'` (the Container already fills). Landing: use `minHeight: '100dvh'` with `overflowY: 'auto'` and make the footer static instead of `position: absolute`. Add a Playwright viewport test at 375x667 and 667x375 asserting no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`).
- Verified: Confirmed: the settings dialog forces minWidth 400 on a 375 px viewport. The Landing page itself passed a 375 px check with no horizontal overflow.

#### F067 · Medium · S3 Enterprise · effort S · priority 4/10

**Route changes update neither the document title nor focus; one static <title> for all four routes**

- Where: `frontend/src/components/layout/LayoutMain.tsx:73`
- Evidence: index.html:9 9 <title>F1 Visualizer</title> (grep for `document.title` / `<title` across src returns no matches) LayoutMain.tsx:73-83 73 <AnimatePresence mode="wait"> 74 <motion.div 75 key={location.pathname} 76 initial…
- Problem: Client-side navigation between /dashboard, /historical and /versus leaves the tab title as 'F1 Visualizer' (WCAG 2.4.2 Page Titled) and performs no focus management: after clicking a nav button, focus stays on the nav button while the outgoing page fades out and the incoming one mounts, so a screen reader never hears that the view changed. The `mode="wait"` exit animation also means the new page's heading does not exist in the DOM for 250 ms after activation, so any naive focus() call would fail.
- Impact: Screen-reader users get no announcement when they switch to Data Vault or Head-to-Head; browser history, bookmarks and tab-switcher all show identical titles for three different tools.
- Fix: Use React 19's hoisted metadata: render `<title>Live Console · F1 Visualizer</title>` at the top of Home/HistoricalData/VersusMode (React 19 hoists `<title>` from any component into <head>, no helmet needed). For focus, give each page an `<h1 tabIndex={-1} ref={headingRef}>` and in LayoutMain call `headingRef.current?.focus({ preventScroll: true })` from `onAnimationComplete` of the entering motion.div (or `useEffect` on `location.pathname` after the wait). Alternatively adopt React Router 7 `handle: { title }` on each Route and a single effect reading `useMatches()`.
- Verified: Confirmed: one static title for four routes and no focus management on navigation.

#### F068 · Medium · S3 Enterprise · effort S · priority 4/10

**Live telemetry values are rendered as <h2>/<h6> headings; pages have no <h1> and the app name is an <h5>**

- Where: `frontend/src/components/RaceSimulator.tsx:303`
- Evidence: RaceSimulator.tsx:303-305 303 <Typography variant="h2" sx={{ fontWeight: 'bold', color: 'white' }}> 304 {lastTelemetry.speed} <span style={{ fontSize: '1.5rem', color: '#666' }}>KM/H</span> 305 </Typography> RaceSimulat…
- Problem: MUI Typography maps `variant="hN"` to a real `<hN>` element unless `component` is set. The speed readout is therefore an `<h2>` and RPM/GEAR/THROTTLE/BRAKE are four `<h6>`s whose text changes up to 60 times per second (useTelemetry.ts:45-53 flushes per rAF). A screen reader's headings list becomes '312', '11000', '7', '100%'. No page has an `<h1>`; the outline goes h5 (site name) -> h4/h3 (page) -> h6, and the page headings start with emoji ('racing car', 'floppy disk') that are announced before the title. WCAG 1.3.1 Info and Relationships, 2.4.6 Headings and Labels.
- Impact: Heading navigation (the primary way screen-reader users skim a page) is unusable on the dashboard and misleading on Versus; the 60 fps mutations to heading nodes also cause AT virtual-buffer churn.
- Fix: Set `component` explicitly: `<Typography variant="h2" component="p">` for the speed value and `component="p"` / `component="dd"` for the four metrics (wrap the grid in a `<dl>` with `<dt>` captions). Make each page title `component="h1"`, the AppBar brand `component="div"`, and section titles `component="h2"`. Put emoji in `aria-hidden` spans or drop them. Add an ESLint guard via `eslint-plugin-jsx-a11y`'s `heading-has-content` plus a unit test that `getAllByRole('heading', { level: 1 })` has length 1 per page.
- Verified: Confirmed: telemetry values render as h2 and h6 elements, the brand is an h5 and no page has an h1.

#### F069 · Medium · S3 Enterprise · effort S · priority 4/10

**No landmarks or skip link: content lives in generic <div>s, nav buttons are not in a <nav>**

- Where: `frontend/src/components/layout/LayoutMain.tsx:72`
- Evidence: LayoutMain.tsx:24 <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}> LayoutMain.tsx:45-49 <LayoutGroup> <NavButton .../> x3 </LayoutGroup> (no <nav>) LayoutMain.tsx:72 <Container maxWidth="xl" s…
- Problem: Apart from AppBar's implicit `<header>` and the footer, there is no `<main>` and no `<nav>`; the three route links are plain Buttons inside a `LayoutGroup` div, so AT cannot jump to navigation or to main content, and there is no skip link to bypass the 5-control header on every page. The 7 s splash and the Landing page render as `position: fixed` motion.divs with no landmark either. WCAG 1.3.1, 2.4.1 Bypass Blocks (A).
- Impact: Screen-reader users must arrow through the brand text and all five header controls on every route change; landmark navigation (a top-3 screen-reader strategy) yields nothing useful.
- Fix: `<Box component="nav" aria-label="Primary">` around the NavButtons (and give the active one `aria-current="page"` — RouterLink does not set it automatically for MUI Button), `<Container component="main" id="main" tabIndex={-1}>` for the outlet, and a visually-hidden skip link as the first child of LayoutMain (`<a href="#main" className="skip-link">Skip to content</a>` with an `:focus` style that reveals it). Render the auth error inside the themed tree with `role="alert"`.
- Verified: Confirmed: no main or nav landmark and no skip link; the nav buttons live in a plain div.

#### F065 · Medium · S3 Enterprise · effort M · priority 4/10

**Lap-time and radar charts are mouse-only SVGs with no title, role or data alternative**

- Where: `frontend/src/components/LapTimeChart.tsx:176`
- Evidence: LapTimeChart.tsx:176 176 <svg ref={svgRef} /> LapTimeChart.tsx:138-163 (data values exposed only via mouseenter/mousemove on invisible circles) 140 svg.selectAll(".hover-dot") 147 .attr("fill", "transparent") 149 .on("m…
- Problem: Both D3 charts are bare `<svg>` elements: no `role="img"`, no `<title>`/`<desc>`, no `aria-labelledby` to the Paper heading, and the lap durations exist only in a hover tooltip attached to transparent, non-focusable circles (no `tabindex`, no `focus`/`keydown` handlers). The radar chart's five attribute values are never printed as text anywhere on the Versus page. WCAG 1.1.1, 2.1.1 Keyboard (A), 1.4.13 Content on Hover.
- Impact: Keyboard and screen-reader users get 'graphic' or nothing for the entire Data Vault page and half of Head-to-Head; even sighted keyboard users cannot read a single lap time.
- Fix: Add `role="img"` and an `aria-labelledby` pointing at the h6 title (plus `<title>` via `svg.append('title')`) to both charts. Provide an equivalent: a visually-hidden or toggleable MUI `<Table>` of driver x lap durations for LapTimeChart, and a `<dl>` of the five stats per driver under RadarChart (data already in `driver.stats`). For pointer parity make the hover dots focusable (`.attr('tabindex', 0).attr('role','button').attr('aria-label', ...)` and bind `focus`/`blur` to the same tooltip show/hide) — with React 19 it is simpler to render the dots as JSX `<circle>` elements and let D3 only compute scales. Give StatComparisonBar bars `role="meter"` with `aria-valuenow`/`aria-valuetext`.
- Verified: Confirmed: both SVG charts lack role, title and any text alternative; values exist only in hover tooltips on non-focusable circles.

#### F070 · Medium · S3 Enterprise · effort S · priority 4/10

**No accessibility test layer, so none of the accessibility findings would be caught by CI**

- Where: `frontend/eslint.config.js:12`
- Evidence: eslint.config.js:12-17 extends: [ js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite, ], Grep across src tests: getByText/findByText/queryByText = 93; ge…
- Problem: The one place a11y is asserted is the splash. The play/pause IconButton has no accessible name in tests (found via bare `getByRole('button')`), the shimmer bars and canvas are found by CSS selectors, and there is no axe pass on any page or the settings Dialog. Because ESLint lacks `jsx-a11y`, missing `aria-label`s on icon buttons or `<canvas>` elements are not flagged either.
- Impact: Screen-reader users get 'button' for play/pause and an unlabeled canvas for the core visualisation; there is no gate to stop it getting worse. Tests keyed on visible text also break on copy changes rather than on behaviour.
- Fix: `yarn add -D vitest-axe eslint-plugin-jsx-a11y`. In setup.ts: `import * as matchers from 'vitest-axe/matchers'; expect.extend(matchers);`. Add a `src/test/renderWithTheme.tsx` helper wrapping `ThemeProvider theme={broadcastTheme}` (export the theme from a `theme.ts`, not App.tsx) and add one `expect(await axe(container)).toHaveNoViolations()` per page test (Landing, Home, HistoricalData, VersusMode, UserSettingsModal open). eslint.config.js: `import jsxA11y from 'eslint-plugin-jsx-a11y'` and add `jsxA11y.flatConfigs.recommended` to `extends`. Refactor the flagged queries to `getByRole('button', { name: /pause/i })` after giving the IconButton an `aria-label`.
- Verified: Confirmed: no axe assertions and no jsx-a11y lint; queries are mostly getByText.

#### F080 · Low · S3 Enterprise · effort S · priority 3/10

**Connection status is colour-only and the 'OFF' label loses its subject; state changes are not announced**

- Where: `frontend/src/components/RaceSimulator.tsx:203`
- Evidence: RaceSimulator.tsx:203-204 203 <Chip label={isTelemetryConnected ? "TELEMETRY: ON" : "OFF"} color={isTelemetryConnected ? "success" : "error"} variant="filled" /> 204 <Chip label={isLocationConnected ? "GPS: ON" : "OFF"}…
- Problem: When a feed drops, both chips read simply 'OFF' — two adjacent 'OFF' badges distinguishable only by green-vs-red fill (WCAG 1.4.1 Use of Colour; also indistinguishable for deuteranopes since the success variant is pure #00ff00 vs error red). Neither chip is a live region, so the transition ON->OFF is silent (4.1.3 Status Messages, AA). The 'Waiting for data' / 'Initialize a session' status text is likewise not announced. (The LIVE FEED CONNECTION LOST Snackbar does use MUI Alert role=alert, which covers the catastrophic case but not partial loss of one feed.)
- Impact: A user relying on a screen reader or with red-green colour deficiency cannot tell which of the two feeds is down, and gets no notification when the GPS feed alone drops (trace freezes while telemetry numbers keep updating).
- Fix: Always include the subject: `label={`TELEMETRY: ${isTelemetryConnected ? 'ON' : 'OFF'}`}`, add a state icon via Chip's `icon` prop (`<CheckCircleIcon/>` / `<ErrorOutlineIcon/>`) so the state is not colour-only, and wrap the two chips in `<Box role="status" aria-live="polite">` (a Box, not each Chip, so both are re-read together). Give the 'Waiting for data' Typography `role="status"` as well.
- Verified: Confirmed: both chips read OFF when disconnected, distinguishable by colour only, and are not live regions.

#### F081 · Low · S3 Enterprise · effort S · priority 3/10

**Timeline slider thumb reduced to a 16 px hit area with zero padding (below the 24 px target minimum)**

- Where: `frontend/src/components/MediaController.tsx:105`
- Evidence: MediaController.tsx:105-116 105 sx={{ 106 color: '#e10600', 107 height: 4, 108 padding: 0, 109 '& .MuiSlider-thumb': { 110 width: 16, 111 height: 16, ... 115 '&.Mui-active': { width: 20, height: 20 }, MUI defaults being…
- Problem: MUI's Slider ships a 20 px thumb inside a 30 px-tall root (44 px on coarse pointers) precisely to meet touch-target guidance. The override sets the root to `height: 4; padding: 0` and the thumb to 16 px, so the only pointer target for seeking is a 16x16 px circle on a 4 px rail (the `pointer: coarse` media rule is neutralised by `padding: 0`). WCAG 2.5.8 Target Size (Minimum, AA) requires 24x24 CSS px.
- Impact: On a phone or a touch laptop, grabbing the seek thumb is a precision task; mis-taps land on the rail and trigger an immediate `onChangeCommitted` seek to a random position (which also wipes the trace via `onSeek`).
- Fix: Remove `padding: 0` (keep MUI's 13/20 px vertical padding, the visual rail stays 4 px) and set the thumb to `width: 24, height: 24` or keep 16 px visually but add `'&::after': { width: 32, height: 32 }` (MUI already renders a transparent `::after` hit-area you can enlarge). Keep the `Mui-focusVisible` shadow you already have.
- Verified: Confirmed: the slider override sets padding 0 and a 16 px thumb.

#### F093 · Low · S2 Fluidity · effort S · priority 2/10

**Emoji read aloud in headings, and dead exit animations on the settings dialog and Landing page**

- Where: `frontend/src/components/layout/UserSettingsModal.tsx:86`
- Evidence: UserSettingsModal.tsx:86 86 <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>⚙️ USER PREFERENCES</DialogTitle> UserSettingsModal.tsx:75 slots={{ paper: motion.div }} RaceSimulator.tsx:199 🏎️ RACE ENGINEER CO…
- Problem: The MUI Dialog semantics survive the `motion.div` paper swap (aria-labelledby, aria-modal, focus trap and focus restore all verified in MUI 9.4.0 source), but the accessible name becomes 'gear USER PREFERENCES' and the page headings 'racing car RACE ENGINEER CONSOLE' / 'floppy disk DATA VAULT'. Also, because the Dialog is not inside an `AnimatePresence`, the declared `exit` animation never runs — harmless for a11y but misleading code.
- Impact: Minor verbosity for screen-reader users and a slightly unprofessional announcement in an otherwise correctly implemented modal.
- Fix: Wrap decorative emoji: `<span aria-hidden="true">⚙️</span> USER PREFERENCES` (or use the MUI `SettingsIcon` with `aria-hidden`). Either delete the unused `exit` prop or wrap the Dialog in `AnimatePresence` and use `TransitionProps`/`keepMounted` so the exit plays.
- Verified: Confirmed: headings start with emoji that screen readers announce, and the Dialog paper slot's exit animation never plays because MUI unmounts it first.

### Theme: Engineering hygiene and gates (S3 Enterprise)

_The gates that would stop regressions are missing: typecheck and build in the PR job, coverage thresholds, an honest visual-test tolerance, type-aware lint, a formatter, dependency automation and pinned images._

Findings: F004, F026, F032, F033, F048, F049, F050, F055, F056, F066, F057, F058, F072, F071, F091, F089, F088, F087, F073, F074, F090, F078, F079, F076, F082, F095, F094, F092, F096

#### F004 · High · S3 Enterprise · effort S · priority 9/10

**The PR gate never typechecks or builds, so a type error merges green and fails in the deploy pipeline**

- Where: `frontend/.github/workflows/pr-checks.yml:59`
- Evidence: pr-checks.yml:59-63 - name: Lint run: yarn lint - name: Test run: yarn test:ci package.json:6-12 "build": "tsc -b && vite build", "lint": "eslint .", "preview": "vite preview", "test:ci": "vitest run" ../cloudbuild/fron…
- Problem: `tsc -b` and `vite build` exist only inside the `build` script, and that script is executed solely by Cloud Build after a push to `main`. Vitest 5 transpiles with esbuild/oxc and does not type-check, ESLint (`tseslint.configs.recommended`, non-type-aware) does not either, so a PR with a TS error, an unresolved import that only the bundler sees, or a Vite config regression passes both PR steps. There is no `typecheck` script for developers or CI to call. Additionally `gh api .../branches/main/protection` returns 403 (private repo on a plan without branch protection), so even the lint/test jobs are advisory rather than required.
- Impact: Broken main: the failure surfaces in the `f1v-frontend-dev` Cloud Build run, after merge, blocking every subsequent deploy until a fix PR lands. Reviewers cannot trust a green PR. The README (line 93-94) even admits `yarn build` is 'the fastest way to catch a type error' — yet CI never runs it before merge.
- Fix: Add a typecheck script running tsc -b to package.json and run it in the PR job between lint and test; add a yarn build --mode dev step so a Vite or rolldown regression is also caught pre-merge; require the job in branch protection. This also makes the duplicated lint and test steps in cloudbuild/frontend.yaml removable.
- Verified: Confirmed: pr-checks.yml runs only yarn lint and yarn test:ci; tsc -b runs solely inside yarn build, which only Cloud Build executes after merge. Production stays protected because Cloud Build typechecks before deploying, so the impact is a red main branch and wasted deploy cycles rather than a broken release. Severity lowered from critical.

#### F026 · High · S3 Enterprise · effort M · priority 6/10

**ESLint is shallow: non-type-aware TS rules, no a11y, no React JSX rules, no import hygiene, `ecmaVersion: 2020` on an ES2022 target**

- Where: `frontend/eslint.config.js:12`
- Evidence: frontend/eslint.config.js:10-22: { files: ['**/*.{ts,tsx}'], extends: [ js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite, ], languageOptions: { ecmaVer…
- Problem: This is the unmodified Vite `react-ts` template config. `tseslint.configs.recommended` is the syntactic tier: no `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-unnecessary-condition`, `restrict-template-expressions` — the rules that catch the async bugs typical of an Axios+STOMP+Auth0 app (unawaited `getAccessTokenSilently()`, promise-returning handlers passed to `onClick`). There is no `eslint-plugin-jsx-a11y` for an app whose core UI is a `<canvas>` plus MUI dialogs; no `eslint-plugin-react` (`jsx-key`, `no-array-index-key`, `self-closing-comp`, `jsx-no-leaked-render`); no `eslint-plugin-import-x` so there is no `import/order`, `no-cycle`, or `no-duplicates` — and the codebase already has 24 `@/` imports vs 111 relative imports plus 24 imports carrying a `.tsx` extension (measured), i.e. exactly the inconsistency an import-order rule would normalise. `ecmaVersion: 2020` contradicts the ES2022 compile target; with ESLint 10 the default is `latest`, so the explicit 2020 is a downgrade left over from the template. Note the codebase is in a good state to absorb stricter rules: 0 `any` casts and 3 `eslint-disable` comments in `src/`.
- Impact: Lint passes (`yarn lint` exit 0) while providing little assurance beyond hooks discipline. Async correctness, accessibility regressions and dependency cycles are invisible at review time; for an enterprise adopter, the missing a11y layer is a compliance gap (WCAG expectations for MUI-based UIs) and the missing type-aware tier means the `strict` tsconfig is only enforced by `tsc`, which CI does not run (finding 1).
- Fix: Replace the `extends` block with: `tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked` plus `languageOptions: { ecmaVersion: 'latest', parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }, globals: globals.browser }`; add `eslint-plugin-jsx-a11y` (`jsxA11y.flatConfigs.recommended`), `eslint-plugin-react` (`react.configs.flat.recommended` + `flat['jsx-runtime']`, settings.react.version 'detect'), and `eslint-plugin-import-x` with `'import-x/order': ['error', { groups: [...], pathGroups: [{ pattern: '@/**', group: 'internal' }], alphabetize: { order: 'asc' } }]`, `'import-x/no-cycle': 'error'`, `'import-x/no-duplicates': 'error'`, and `'import-x/extensions': ['error', 'never']` to retire the `.tsx` suffix imports. Add a second config object for `**/*.test.{ts,tsx}` and `src/test/**` that disables `no-unsafe-*` and enables `eslint-plugin-vitest` recommended. Keep `reactHooks.configs.flat.recommended` — it is already the v7 compiler-derived ruleset (see strengths). Run with `--max-warnings 0` in CI so `exhaustive-deps` warnings cannot accumulate.
- Risk: Type-aware linting will surface existing warnings; land it with warnings allowed first, then enforce max-warnings 0.
- Verified: Confirmed: eslint.config.js is the unmodified Vite template with the syntactic typescript-eslint tier, no jsx-a11y, no eslint-plugin-react, no import rules and ecmaVersion 2020 on an ES2022 target. Type-aware rules such as no-floating-promises would catch the class of async bug that this Axios plus STOMP plus Auth0 app is prone to.

#### F032 · Medium · S3 Enterprise · effort S · priority 5/10

**Runtime and builder base images still float despite the "pin every image" commit**

- Where: `frontend/Dockerfile:22`
- Evidence: frontend/Dockerfile:4: FROM node:26-alpine AS builder frontend/Dockerfile:22: FROM nginxinc/nginx-unprivileged:alpine frontend/Dockerfile.ci:10: FROM nginxinc/nginx-unprivileged:alpine cloudbuild/frontend.yaml:22,34,43,…
- Problem: Commit d3c6bd3 claims reproducible deploys, but the image that actually serves production — `nginxinc/nginx-unprivileged:alpine` in both Dockerfiles — carries no nginx version and no Alpine version at all; it will silently move across nginx minors/majors and Alpine releases on every rebuild. `node:26-alpine` is a major-only tag that tracks every Node 26.x patch and every Alpine bump, so `yarn install --frozen-lockfile` reproducibility is undermined by an un-pinned native toolchain (this matters here because `canvas` is compiled from source against whatever musl/cairo Alpine ships that day, `cloudbuild/frontend.yaml:28-30`). Neither uses a `@sha256:` digest. The `--cache-from $IMAGE:latest-${_ENV}` layer cache (frontend.yaml:76) also cannot hit when the base image changes underneath it.
- Impact: Two builds of the same commit can produce different nginx binaries and different `canvas` native builds; a broken upstream `:alpine` push (nginx has shipped regressions in minor releases) lands in prod with no diff in this repo to bisect. This is the first thing a supply-chain or SRE reviewer checks, and the commit message makes it a credibility issue.
- Fix: Pin to full versions with digests: `FROM node:26.8.1-alpine3.22@sha256:<digest>` and `FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:<digest>` (same string in Dockerfile, Dockerfile.ci and the four Cloud Build `name:` entries — consider a `_NODE_IMAGE` substitution in cloudbuild/frontend.yaml so it is declared once). Add a `.github/dependabot.yml` with `package-ecosystem: docker` for `/frontend` (and `/cloudbuild` via `directories`) so the digests are bumped by PR rather than by drift. Since Dockerfile and Dockerfile.ci duplicate the nginx stage verbatim (nginx.conf COPY, dist COPY, EXPOSE, CMD), collapse them into one Dockerfile with `--target` stages (`builder`, `runtime`) and have Cloud Build pass `--target runtime` plus a `COPY --from` override, or at minimum declare the base in one shared `ARG NGINX_IMAGE` line.
- Verified: Confirmed in both Dockerfiles and cloudbuild/frontend.yaml: node:26-alpine and nginxinc/nginx-unprivileged:alpine carry no digest, contradicting the intent of the pin-every-image commit. Lowered from high because the images are rebuilt rarely.

#### F033 · Medium · S3 Enterprise · effort S · priority 5/10

**No automated dependency updates or supply-chain gates: no Dependabot config, no audit step, no image scan, actions pinned to majors**

- Where: `frontend/.github/workflows/pr-checks.yml:59`
- Evidence: .github/workflows/pr-checks.yml:59-66: `run: yarn install --frozen-lockfile` / `run: yarn lint` / `run: yarn test:ci` — no audit step .github/workflows/pr-checks.yml:82-88: Trivy runs with `scan-type: config` on `infras…
- Problem: `--frozen-lockfile` guarantees reproducibility but not freshness or safety: nothing bumps sockjs-client/url-parse/axios/etc., nothing fails a PR on a newly published advisory, and the runtime image is rebuilt from whatever `nginx-unprivileged:alpine` resolves to at that moment. `yarn audit` currently reports 0 vulnerabilities, but that is a point-in-time observation with no process behind it. No SBOM is produced, so answering 'are we affected by CVE-X' requires a manual `yarn why`.
- Impact: A vulnerable transitive package (this stack has 569 packages incl. an abandoned SockJS chain) stays in prod until someone notices; a compromised or regressed base-image tag silently changes the runtime between two identical commits.
- Fix:

  1. Add `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: npm
      directory: /frontend
      schedule: { interval: weekly }
      groups: { minor-and-patch: { update-types: [minor, patch] } }
    - package-ecosystem: docker
      directory: /frontend
      schedule: { interval: weekly }
    - package-ecosystem: github-actions
      directory: /
      schedule: { interval: weekly }
  ```
  2. In pr-checks.yml frontend job add `- run: yarn audit --level high || [ $? -lt 8 ]` (yarn 1 exit code is a bitmask; 8+ = high/critical).
  3. In cloudbuild/frontend.yaml insert an `aquasec/trivy image --exit-code 1 --severity HIGH,CRITICAL $$IMAGE:${_SHORT_SHA}` step between build and push, and `trivy image --format cyclonedx --output sbom.json` uploaded as a build artifact.
  4. Pin `FROM nginxinc/nginx-unprivileged:alpine@sha256:<digest>` and `node:26-alpine@sha256:<digest>` (Dependabot docker ecosystem will then keep the digests fresh).

- Verified: Confirmed: no dependabot.yml, no audit step, no image scan, actions pinned to majors only. The transitive picomatch pin in package.json resolutions was applied by hand.

#### F048 · Medium · S3 Enterprise · effort S · priority 5/10

**App.tsx (routing, auth guard, splash handoff) has no tests and cannot be imported under jsdom**

- Where: `frontend/src/App.tsx:95`
- Evidence: src/App.tsx:95-110 const RequiredAuth: React.FC = () => { const { isAuthenticated, isLoading, error } = useAuth0(); ... const [showSplash, setShowSplash] = useState(() => { const flag = sessionStorage.getItem('f1v:post-…
- Problem: The auth guard, the `/` -> `/dashboard` redirect, the `Navigate to="/"` bounce for unauthenticated users, the `sessionStorage` post-login handshake between `onRedirectCallback` and `RequiredAuth`, the 400 ms staggered prefetch, and the 'Authentication Error' branch are all untested. They cannot be tested today because importing App.tsx transitively evaluates `useSplashSequence.ts:31`, which throws `window.matchMedia is not a function` in jsdom. The hook's own 'test' asserts only that an array literal has length 6 and that `indexOf` is monotonic (useSplashSequence.test.ts:15-16, 35-42) — it never executes the hook. SplashScreen.test.tsx:20-22 mocks the hook away entirely, so the 7 s timeline, the `onComplete` firing at `TOTAL_DURATION`, and the reduced-motion 500 ms path have no runtime coverage.
- Impact: The most fragile flow in the app (the comment at App.tsx:98-102 documents a previous approach that silently broke) is exactly the one with no safety net. A regression here means users land on a blank page after Auth0 redirect or loop between `/` and `/dashboard`.
- Fix: 1. setup.ts: add a standard `matchMedia` stub (`Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn().mockImplementation(q=>({matches:false,media:q,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))})`). 2. useSplashSequence.ts: move the `matchMedia` read into the `useState` initializer (or `useSyncExternalStore`) so it is evaluated per mount, not at import time; then write a real hook test with `vi.useFakeTimers({toFake:['requestAnimationFrame','performance','setTimeout']})` + `vi.advanceTimersByTimeAsync(7000)` asserting phase transitions and `onComplete`. 3. Extract the `<Routes>` tree into `AppRoutes` (exported) so a test can render `<MemoryRouter initialEntries={['/dashboard']}><AppRoutes/></MemoryRouter>` with `vi.mock('@auth0/auth0-react')`. Cases: unauthenticated `/dashboard` -> Landing; authenticated `/` -> `/dashboard`; `sessionStorage.setItem('f1v:post-login','1')` -> SplashScreen rendered, `fetchDrivers` called immediately, `fetchSessions` after `advanceTimersByTime(400)`, flag removed; `error` -> 'Authentication Error'; `isLoading` -> renders nothing.
- Verified: Confirmed: 5 of 41 source files have no test and App.tsx is the largest of them; useSplashSequence reads window.matchMedia at module scope, which jsdom lacks, and the six 'Not implemented' warnings in every run come from window.scrollTo.

#### F049 · Medium · S3 Enterprise · effort S · priority 5/10

**Native-canvas visual regression: baselines rendered by macOS prebuilt Cairo, CI compiles a different Cairo on Alpine, README misstates the tolerance 100x, and Cloud Build is not detected as CI so missing baselines are silently written**

- Where: `frontend/src/components/__tests__/CircuitTrace.visual.test.ts:115`
- Evidence: src/components/__tests__/CircuitTrace.visual.test.ts:115-119 expect(image).toMatchImageSnapshot({ customSnapshotIdentifier: 'circuit-trace-oval-selected', failureThreshold: 0.01, failureThresholdType: 'percent', }); nod…
- Problem: Three separate issues. (a) Tolerance: `failureThreshold: 0.01` with `'percent'` means 1% of pixels (4,000 px on the 800x500 canvases), not the 0.01% the README promises; the whole 6 px car dot is ~113 px, so it could move anywhere on the canvas and still pass. (b) Platform: the five baselines were produced on macOS by the prebuilt binary's bundled Cairo 1.18.4; ubuntu-latest (PR checks) uses the glibc prebuilt, and Alpine (Cloud Build) compiles against a third Cairo/pixman — antialiasing of the 1.5 px and 4 px strokes can differ per build. The loose 1% tolerance is what currently absorbs that, at the cost of masking real regressions. (c) On Cloud Build `process.env.CI` is unset and std-env does not recognise Cloud Build, so Vitest runs with `updateSnapshot: 'new'`: if a baseline is missing or an identifier is renamed, the PNG is silently written and the test passes on the deploy pipeline. Finally, the test re-implements the drawing loop (lines 59-108) rather than exercising CircuitTrace.tsx, so it only validates `circuitProjection.ts`, which circuitProjection.test.ts (165 LOC) already covers — while costing a C++ toolchain + apk installs on every Cloud Build.
- Impact: False confidence on the one visual gate; a real projection bug (mirrored Y, wrong padding) inside 1% would pass, while a benign Cairo upgrade on Alpine could fail the deploy pipeline. Cloud Build minutes are spent compiling node-canvas for a test that duplicates a pure unit test.
- Fix: Short term: set `env: ['CI=true']` on the Cloud Build `test` step; change to `failureThresholdType: 'pixel', failureThreshold: 25` (or `'percent', 0.0001`) and fix README.md:185; add `comparisonMethod: 'ssim'` only if antialiasing drift proves a problem. Medium term: replace the native-canvas test with a deterministic geometry snapshot — assert the projected polyline (`projectPoint` output array rounded to 0.1 px) with `toMatchInlineSnapshot`, which needs no Cairo and is platform-independent; move true pixel comparison into a Playwright `expect(page).toHaveScreenshot()` run inside the pinned `mcr.microsoft.com/playwright` image (see e2e finding), where the browser build is the one rendering. Then drop `canvas`, `jest-image-snapshot`, the apk toolchain in cloudbuild steps 1 and 3, and `src/test/vitest.d.ts`.
- Verified: Confirmed: all five snapshots use failureThreshold 0.01 with failureThresholdType 'percent', which is one percent of pixels, while README line 185 claims 0.01 percent. Baselines were rendered on macOS and CI compiles a different Cairo on Alpine.

#### F050 · Medium · S3 Enterprise · effort S · priority 5/10

**No coverage provider, thresholds, or report — and the un-measured gaps are exactly the risky branches (ErrorBoundary retry, DriverSelector onChange, loader timers, CircuitTrace draw args)**

- Where: `frontend/vitest.config.ts:16`
- Evidence: vitest.config.ts:16-21 test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.{test,spec}.{ts,tsx}'], }, `yarn vitest run --coverage` -> " MISSING DEPENDENCY Cannot find depe…
- Problem: 188 tests exist but nothing measures what they exercise, and reading them shows a pattern of 'renders without crashing' assertions: `toHaveBeenCalled()` without arguments, tests whose name promises a behaviour (team colour, axis labels) that the body never checks, and interactive components where the interaction is never triggered. Without `@vitest/coverage-v8` and thresholds, a PR that deletes a test or adds an untested 300-line component passes identically.
- Impact: Regressions in retry/recovery UX (ErrorBoundary), driver selection (DriverSelector is used by UserSettingsModal and VersusMode), and the canvas colour/scale logic ship undetected; the team cannot see or trend coverage in PRs.
- Fix:

  `yarn add -D @vitest/coverage-v8@5` and in vitest.config.ts:
  ```ts
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/**/__tests__/**', 'src/test/**', 'src/main.tsx', 'src/types/**'],
    reporter: ['text', 'lcov', 'json-summary'],
    thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 },
  },
  ```
  Change `test:ci` to `vitest run --coverage`, upload `coverage/` as an artifact and add `davelosert/vitest-coverage-report-action@v2` for a PR comment. Then close the specific gaps: ErrorBoundary — `vi.useFakeTimers()`, throw, `advanceTimersByTime(2000)`, assert child re-mounts, repeat 3x and assert RETRY/RELOAD buttons appear, click RETRY, stub `window.location.reload`; DriverSelector — `userEvent.click(getByRole('combobox'))`, pick an option, assert `onChange` called with the profile, clear via the MUI clear button; CircuitTrace — assert `mockCtx.strokeStyle` was set to `'#3671C6'` and `lineWidth` to 4 before `stroke()`; loaders — fake timers + advance 2 s, assert second message.

- Verified: Confirmed: no coverage provider or thresholds are configured, and @vitest/coverage-v8 is not installed.

#### F055 · Medium · S3 Enterprise · effort S · priority 4/10

**The local Dockerfile compiles the test-only native canvas addon without its toolchain and copies stale files into the builder**

- Where: `frontend/Dockerfile:13`
- Evidence: frontend/Dockerfile:4 `FROM node:26-alpine AS builder` :13 `RUN yarn install --frozen-lockfile` :16 `COPY . .` :17 `RUN yarn build --mode ${ENV_MODE}`. cloudbuild/frontend.yaml:20-22 `# canvas (node-canvas) is a native …
- Problem: The build stage needs only vite/tsc, but `yarn install` also compiles `canvas` (no musl prebuilt) — which the CI file explicitly says fails on Alpine without the listed packages that this Dockerfile never installs. The README-documented local image build is therefore either broken or, if it works, spends minutes compiling Cairo bindings for an image that never runs tests. `COPY . .` additionally copies the host's dist/ and busts the layer cache on every local build.
- Impact: Developers cannot reproduce the production image locally with the documented command, and the divergence between Dockerfile and Dockerfile.ci means the container that runs in prod is never the one built locally. Build-time only; no runtime bundle impact.
- Fix: In Dockerfile: `RUN yarn install --frozen-lockfile --ignore-scripts` (skips the canvas node-gyp step; vite/tsc need no install scripts), and replace `COPY . .` with `COPY index.html tsconfig*.json vite.config.ts .env.* ./` + `COPY public ./public` + `COPY src ./src`. Longer term, move `canvas` and `jest-image-snapshot` to `optionalDependencies` and pass `--ignore-optional` in build-only contexts so Cloud Build's install step (cloudbuild/frontend.yaml:28-30) can also drop the apk toolchain from the lint/build steps.
- Verified: Confirmed: the local Dockerfile runs a plain yarn install, which compiles the native canvas addon on Alpine without the toolchain that cloudbuild/frontend.yaml documents as required, and COPY . . pulls in tests, snapshots and any stale local dist.

#### F056 · Medium · S3 Enterprise · effort S · priority 4/10

**No formatter, EditorConfig, import-order rule or pre-commit hook; three import styles and naming inconsistencies coexist**

- Where: `frontend/vitest.config.ts:10`
- Evidence: Presence check (root and frontend/): .prettierrc*, prettier.config.js, .editorconfig, .husky/, lint-staged.config.js — all missing; node_modules/.bin has no prettier, husky or lint-staged. frontend/vite.config.ts:5-9 (2…
- Problem: There is no `format`/`format:check` script, no Prettier or Biome config, no `.editorconfig`, and no git hook. Two sibling config files in the same directory already use different indentation and semicolon conventions; `src/` mixes 4-space files with the 2-space template files. Nothing prevents a contributor's editor from reformatting a whole file on save and producing a noise diff, and nothing runs lint/typecheck before a commit reaches CI.
- Impact: Review noise (whitespace-only hunks), bikeshedding in PRs, and slower feedback: a contributor learns about a lint failure only after pushing and waiting for the Actions job. For an enterprise codebase, a formatter and pre-commit gate are table stakes and their absence is one of the first items on an onboarding audit.
- Fix: Add `.editorconfig` (root, `indent_style=space`, `indent_size=2`, `end_of_line=lf`, `insert_final_newline=true`). Add Prettier 3 with `eslint-config-prettier` appended last in `eslint.config.js` (or Biome 2 as a single fast formatter+linter if you want to avoid two tools), scripts `"format": "prettier --write ."` and `"format:check": "prettier --check ."`, and run `format:check` in pr-checks.yml. Add `simple-git-hooks` (lighter than Husky, no postinstall script) + `lint-staged` with `{"*.{ts,tsx}": ["eslint --fix --max-warnings 0", "prettier --write"], "*.{json,md,yml}": "prettier --write"}`. Land the initial reformat as a single commit and add its SHA to `.git-blame-ignore-revs` so blame stays useful.
- Verified: Confirmed: no Prettier or Biome, no .editorconfig, no git hook; six files use the @ alias (four with a .tsx extension) while the rest use relative paths; one test file is misnamed (UserSettingsModel.test.tsx).

#### F066 · Medium · S3 Enterprise · effort L · priority 4/10

**No end-to-end layer: Auth0 redirect handshake, STOMP reconnect and canvas resize are only ever exercised in production**

- Where: `frontend/src/test/setup.ts:8`
- Evidence: src/test/setup.ts:5-11 // ResizeObserver mock (jsdom doesn't support it) class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} } src/components/CircuitTrace.tsx:96-101 (never fires in tests) const obser…
- Problem: Everything above the component boundary is mocked: `useAuth0`, `stompClient`, `ResizeObserver` (no-op), `d3`, `canvas.getContext`. The pyramid therefore has a wide unit base and nothing on top — no test ever loads `index.html`, runs the real Vite build, connects the real SockJS/STOMP stack through the `define: { global: 'window' }` shim (vite.config.ts:11-13), or resizes a viewport to see the canvas re-scale. The nginx SPA fallback and CSP headers in nginx.conf are likewise unverified.
- Impact: The classes of bug users actually hit — CSP blocking Auth0 or SockJS, a `global` shim regression breaking the WebSocket in the prod bundle only, the splash never dismissing — are invisible to CI.
- Fix: Add `@playwright/test` with `playwright.config.ts` `webServer: { command: 'yarn vite preview --port 4173', port: 4173 }` and `projects: [{ name: 'chromium' }]`. Stub Auth0 with `page.route('**/authorize**')` + a seeded `storageState` (or an Auth0 test tenant with a service-user), stub REST via `page.route('**/api/v1/**')`, and add a `VITE_STOMP_URL` env so the e2e run points STOMP at a tiny Node `ws` fixture that replays a recorded `/topic/race-location` stream. Three smoke specs cover the value: (1) `/` -> Login -> `/dashboard` shows splash then LayoutMain; (2) start SIMULATION -> canvas draws (assert `toHaveScreenshot('circuit.png', {maxDiffPixels: 50})` inside the pinned `mcr.microsoft.com/playwright:v1.5x` image — this replaces the node-canvas approach); (3) resize viewport 1280 -> 600 and assert canvas `width` attribute changes. New GH job `frontend-e2e` (needs: frontend) uploading the Playwright report on failure. For a11y, add `@axe-core/playwright` to spec (1).
- Verified: Confirmed: everything above the component boundary is mocked; nothing exercises the built app, the Auth0 redirect or the real STOMP stack.

#### F057 · Medium · S3 Enterprise · effort L · priority 4/10

**RaceSimulator is a 375-line god component: 13 useState + 4 useRef, domain algorithm inside a render closure**

- Where: `frontend/src/components/RaceSimulator.tsx:88`
- Evidence: RaceSimulator.tsx:26-50 — thirteen useState / four useRef declarations RaceSimulator.tsx:1 + :14 import React, { useState, useEffect, useRef } from 'react'; ... import { useCallback } from 'react'; RaceSimulator.tsx:88-…
- Problem: One file owns: reference-data fetching (54-83), the session lifecycle state machine (idle -> initializing -> active, spread over `activeSession`, `isInitializing`, `sessionMeta`, `traceResetKey`), a lap-correlation algorithm that re-filters and re-sorts the whole lap array with `new Date()` parsing on every flushed telemetry frame, a DTO mapper (`RaceEntryRoster -> DriverProfile[]`) that fabricates fake stats, and ~180 lines of presentational JSX (194-373) including inline compound-colour logic (289-293). The `useState` + mirror-`useRef` pairs (40/42/85/86) exist only because the algorithm lives in a closure; `sessionLaps` as React state is never rendered. The stray second `import { useCallback } from 'react'` on line 14 signals unreviewed accretion.
- Impact: The most business-critical screen is the hardest to change and to test: RaceSimulator.test.tsx cannot exercise lap correlation without mocking two STOMP hooks and the whole component tree. A second telemetry-driven page (e.g. a timing tower) would have to re-implement session lifecycle from scratch.
- Fix: Split by responsibility, keeping the file as a thin composition root: 1. `features/live/lapCorrelation.ts` — pure `findCurrentLap(sortedLaps: LapDataRecord[], atMs: number): CurrentLap | null`; pre-sort once per driver in a `useMemo` keyed on `sessionLaps`, and unit-test it directly. 2. `features/live/useRaceSession.ts` — `useReducer` with `{ status: 'idle' } | { status: 'initializing', session } | { status: 'active', session }` and actions `start/firstFrame/seek/cancel`; this removes `isInitializing`, `sessionMeta`, `activeSession`, `traceResetKey` as separate states and the two ref mirrors. 3. `api/mappers.ts` — `rosterToDriverProfiles(roster)`; make `DriverProfile.stats` optional or a discriminated `SessionDriver` type instead of fabricating 80/80/80 values. 4. Presentational `LiveTelemetryPanel` (lines 245-341) and `ConnectionChips` (202-205) components; `COMPOUND_COLOURS` map in theme tokens. Use React 19 `useEffectEvent` for the telemetry callback so it can read latest state without the ref-mirror dance.
- Verified: Confirmed: RaceSimulator.tsx holds 13 useState and 4 useRef, the session lifecycle, a lap-correlation algorithm inside a callback, a DTO mapper and the layout. Lowered from high because it is a maintainability concern rather than a defect.

#### F058 · Medium · S3 Enterprise · effort M · priority 4/10

**Design tokens are not centralised: brand red in 14 files, paper grey in 17 places, font family re-declared 22 times despite the MUI theme**

- Where: `frontend/src/App.tsx:19`
- Evidence: grep -rl -iE '#e10600|225, ?6, ?0' src (excl. tests) -> 14 files, 36 occurrences: App.tsx, utils/chartScales.ts, MediaController.tsx, HeadToHeadLoader.tsx, CircuitTraceLoadingOverlay.tsx, DataVaultLoader.tsx, RaceSimula…
- Problem: The 74-line `createTheme` call lives in App.tsx next to auth guards and routing, and the rest of the codebase does not consume it: `primary.main` is `#e10600` but 35 other sites hardcode the literal, and `Typography`/`sx` blocks re-declare a `fontFamily` the theme already provides globally. Tyre-compound colours are an inline ternary in JSX. Canvas and d3 code (CircuitTrace.tsx:220, LapTimeChart.tsx:51/70/81) cannot read theme values because nothing exports them.
- Impact: A rebrand, a light theme, or a per-team accent requires a 14-file search-and-replace; MUI 9's CSS-variables theme cannot be adopted incrementally because nothing reads the theme today.
- Fix: Create `src/theme/tokens.ts` (`export const BRAND_RED = '#e10600'; export const PAPER_BG = '#1e1e1e'; export const COMPOUND_COLOURS: Record<Compound, string> = {...}; export const TEAM_FALLBACK_COLOURS = [...]`) and `src/theme/theme.ts` with `createTheme({ cssVariables: true, palette: { primary: { main: BRAND_RED } }, ... })` (MUI 9 supports `cssVariables`, which exposes `var(--mui-palette-primary-main)` usable from canvas via `getComputedStyle`). Replace every `sx={{ color: '#e10600' }}` with `color: 'primary.main'`, delete the redundant `fontFamily` declarations, and have `utils/chartScales.ts` import `TEAM_FALLBACK_COLOURS`. Add a lint rule (`no-restricted-syntax` on `/#e10600/i` literal outside `src/theme/`).
- Verified: Confirmed by grep: 144 hard-coded hex colours across 39 distinct values in src, the brand red repeated outside the theme, and fontFamily re-declared per component.

#### F072 · Low · S1 Performance · effort S · priority 4/10

**Vitest creates 38 isolated jsdom environments (35% of wall time); `isolate: false` measured 43% faster, `pool: 'vmThreads'` 39% faster**

- Where: `frontend/vitest.config.ts:18`
- Evidence: vitest.config.ts:16-21 test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.{test,spec}.{ts,tsx}'], }, // no pool / isolate / css / reporters Measured on this machine (188 …
- Problem: Every test file boots its own jsdom + re-imports MUI/Emotion/framer-motion (the 'import 36%' share). The suite is small enough (5.7 s) that sharding is unnecessary, but the per-file environment cost dominates and will scale linearly as tests are added. Nothing is cached between PR runs beyond the yarn cache (no `cacheDir` persisted, no vite `deps.optimizer` config).
- Impact: Developer watch-mode feedback and CI minutes; more importantly it sets the trajectory — at 100 files this becomes a 15 s+ suite for no reason.
- Fix:

  In vitest.config.ts:
  ```ts
  test: {
    ...,
    isolate: false,          // measured 5.68s -> 3.25s
    css: false,
    restoreMocks: true,
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['default'],
  }
  ```
  `isolate: false` is safe here because the only module-level state (referenceApi caches, the stompClient singleton, apiClient) is already reset by `vi.resetModules()` in referenceApi.test.ts:15, apiClient.test.ts:5, stompClient.test.ts:30; keep `vi.mock` factories per file as they are. If a leak ever appears, fall back to `pool: 'vmThreads'` (3.47 s, retains isolation). Do not add sharding until the suite exceeds ~60 s. Add `reporters: ['junit']` with `outputFile` in Cloud Build only if test results need to be surfaced there.

- Risk: isolate: false relies on tests resetting module state; watch for order-dependent failures.
- Verified: Confirmed by the Vitest report: jsdom is created 38 times, 36 percent of tracked time.

#### F071 · Low · S1 Performance · effort S · priority 4/10

**React Compiler is not enabled although the codebase already passes the compiler's lint rules and plugin-react 6 supports it natively**

- Where: `frontend/vite.config.ts:6`
- Evidence: vite.config.ts:6: plugins: [react()], eslint.config.js:15: reactHooks.configs.flat.recommended, (eslint-plugin-react-hooks 7.1.1 recommended enables react-hooks/refs, purity, immutability, set-state-in-effect, preserve-…
- Problem: Almost every re-render finding above (inline handler identity, sx object churn, context value churn, unmemoized children) is exactly what React Compiler auto-memoizes. The project is on React 19.2 and @vitejs/plugin-react 6.1.1, which offers `react({ compiler: true })` through the Rust `oxc-transform-react` port (no Babel needed on the rolldown pipeline) or the Babel path via `reactCompilerPreset`. The code is compiler-safe as far as the compiler's own diagnostics go: refs are only mutated in effects/callbacks (CircuitTrace.tsx:51-67, useTelemetry.ts:11-13), no state is set during render, and the only manual memoization (RaceSimulator.tsx:154-188, VersusMode.tsx:15-33) passes preserve-manual-memoization.
- Impact: Missing a near-free, framework-idiomatic win that would cut most of the dashboard's per-tick reconciliation without touching component code; also signals to reviewers that the React 19 toolchain is not fully adopted.
- Fix: Install oxc-transform-react and enable react({ compiler: { logDiagnostics: true } }) in vite.config.ts; review diagnostics for bail-outs, run the full suite, then ship. This automatically memoises most of the identity churn behind the re-render findings, but it cannot move per-tick state down the tree, so colocate that first.
- Verified: Confirmed: the installed @vitejs/plugin-react 6 README documents react({ compiler: true }) via oxc-transform-react, and the codebase already passes the compiler-era lint rules.

#### F091 · Low · S3 Enterprise · effort S · priority 3/10

**act() warnings on every run and sleep-based synchronisation; hook tests wait on real 500 ms intervals (~2.1 s of the 5.7 s suite)**

- Where: `frontend/src/components/__tests__/RaceSimulator.test.tsx:56`
- Evidence: src/components/__tests__/RaceSimulator.test.tsx:56 screen.getByText('Start Mock Stream').click(); run log: 7x "An update to RaceSimulator inside a test was not wrapped in act(...)" (stderr, test 'displays CONNECTION LOS…
- Problem: A raw DOM `.click()` outside `act` (line 56) triggers React 19's act warning seven times per run; the suite is green only because warnings are not fatal. Elsewhere, correctness is sequenced with `setTimeout(0)`/`setTimeout(50)` sleeps rather than `findBy*`/`waitFor` or fake timers, which is both slow and timing-dependent (a slower CI runner makes the 50 ms CircuitTrace sleeps flaky — the rAF spy at CircuitTrace.test.tsx:92-94 schedules frames at 16 ms). The hook tests spend a full real 500 ms each waiting for `setInterval` because `vi.useFakeTimers` is not used there.
- Impact: Flake risk on ubuntu-latest and Alpine Cloud Build workers; noise that hides genuine act warnings (which in React 19 indicate un-flushed effects, i.e. assertions running against stale DOM); ~40% of wall time wasted in sleeps.
- Fix: Replace line 56 with `fireEvent.click(...)` (RTL wraps it in act) or install `@testing-library/user-event` and use `await user.click(...)`. Replace every `await act(async () => { await new Promise(r => setTimeout(r, 0)); })` with `await screen.findBy...`/`await waitFor(...)` on the observable outcome. In useTelemetry/useLocation tests: `vi.useFakeTimers()` in `beforeEach`, `await vi.advanceTimersByTimeAsync(500)` to trigger the poll, `await vi.advanceTimersByTimeAsync(16)` for the rAF flush, `vi.useRealTimers()` in `afterEach`. Make act warnings fatal so they cannot creep back: in setup.ts, `const err = console.error; vi.spyOn(console,'error').mockImplementation((...a)=>{ if (String(a[0]).includes('not wrapped in act')) throw new Error(a[0]); err(...a); });`.
- Verified: Confirmed: a raw DOM click outside act triggers React 19 warnings, and hook tests wait on real 500 ms intervals.

#### F089 · Low · S3 Enterprise · effort S · priority 3/10

**Duplicated Vite and Vitest config with a __dirname deprecation warning; test globals leak into app types**

- Where: `frontend/vite.config.ts:9`
- Evidence: frontend/vite.config.ts:3-14: import path from 'path' export default defineConfig({ plugins: [react()], resolve: { alias: { '@': path.resolve(__dirname, './src'), }, }, define: { global: 'window', }, frontend/vitest.con…
- Problem: `package.json` declares `"type": "module"`, so `__dirname` does not exist in vite.config.ts; it only works because Vite's bundle config loader injects `__vite_injected_original_dirname` (node.js:37025-37040), and Vite 8 now prints a deprecation warning on every `vite`/`vite build` invocation pointing at this line, because the upcoming native loader will not shim it. The test config re-implements the same alias with its own manual `fileURLToPath` shim and copies the `react()` plugin, but omits `define: { global: 'window' }` — so tests run against a different module graph than the build (sockjs-client's `global` references would throw under Vitest if it were ever imported unmocked). Two configs = two places to keep plugins, aliases, defines and future `build`/`optimizeDeps` settings in sync, and Vite 8 makes the alias itself unnecessary via the built-in `resolve.tsconfigPaths` option, which reads `tsconfig.app.json`'s `paths` directly. There is also no `build` block at all — no `sourcemap` policy, no `chunkSizeWarningLimit`, no `target` alignment with the ES2022 tsconfig (Vite 8 defaults to `baseline-widely-available`), and nothing for `rolldownOptions.output` (the bundle finder owns the splitting recommendation).
- Impact: Every dev-server start and CI build emits a yellow deprecation warning that trains contributors to ignore Vite output; the next Vite major turns it into a hard failure. Config drift between test and build is a latent "passes in Vitest, breaks in the browser" class of bug. Duplicated config is the kind of thing an enterprise reviewer flags as a maintenance smell within the first five minutes.
- Fix: Delete `vitest.config.ts`. In `vite.config.ts`: add `/// <reference types="vitest/config" />` at the top, replace the alias block with `resolve: { tsconfigPaths: true }` (Vite 8 built-in; drop the `path` import), move the `test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.{test,spec}.{ts,tsx}'] }` key in, and add an explicit `build: { target: 'es2022', sourcemap: 'hidden', chunkSizeWarningLimit: 600 }` block so those decisions are visible. If you must keep a Node path, use `import.meta.dirname` (Node 20.11+; Node 26 here). Update `tsconfig.node.json:23` `include` to drop `vitest.config.ts` and the README Scripts table accordingly.
- Verified: Confirmed: vite.config.ts and vitest.config.ts duplicate plugin and alias setup, the former uses __dirname (Vite 8 warns on every build), and vitest/globals types leak into app code.

#### F088 · Low · S3 Enterprise · effort S · priority 3/10

**Toolchain and release hygiene: no engines or packageManager, no .nvmrc, five npm scripts, no versioning or changelog**

- Where: `frontend/package.json:4`
- Evidence: frontend/package.json:4: "version": "0.0.0", git tag -> (empty); git log --oneline | wc -l -> 224 Last 60 commit subjects: 31 conventional (feat/fix/chore/docs/ci ...), 1 non-conventional ("Add HTTP security headers to …
- Problem: The team already writes Conventional Commits (31 of the last 32 non-merge commits), which is the exact input `release-please`/`changesets`/`semantic-release` need, but nothing consumes them: no git tag has ever been cut, `version` is the template's `0.0.0`, and the only artifact identity is a Cloud Build short SHA that defaults to the literal string `manual-build`. The root README describes a dev -> uat -> prod promotion flow by PR but there is no CHANGELOG to say what a promotion contains, no PR template to enforce it, and no CODEOWNERS to route reviews. Significant architectural decisions that the code comments defend at length (STOMP-over-SockJS instead of raw WS, JWT in the CONNECT frame, canvas native in tests with Cairo on Alpine, committing `.env.*`, per-host CSP maps in nginx) live only in nginx.conf/README prose and commit messages, not in ADRs.
- Impact: Support cannot map a user-reported issue to a release; a UAT promotion PR has no human-readable diff of behaviour; rollbacks require reading git history. Institutional knowledge about why the stack looks the way it does is spread across comments in `nginx.conf` and 64 KB of README and will not survive team turnover — a standard enterprise-readiness gap.
- Fix: Adopt `release-please` (GitHub Action, `release-type: node`, `path: frontend`) — it turns the existing conventional commits into a CHANGELOG.md, bumps `package.json` version, and tags `frontend-v1.x.y`; make Cloud Build's image tag `${TAG_NAME}` on tag triggers and keep `${SHORT_SHA}` for dev. Expose the version in the bundle (`define: { __APP_VERSION__ }`) and in a `<meta name="version">` for support. Add `.github/CODEOWNERS` (`/frontend/ @frontend-owners`), `.github/pull_request_template.md` with a checklist (typecheck, tests, screenshots for UI, CHANGELOG-worthy?), and a `docs/adr/` folder using the MADR template, seeded by lifting the five decisions above out of comments. Fix `_SHORT_SHA: 'manual-build'` to fail loudly (`set -u` already exists in the docker step; make the substitution required via a trigger-level check).
- Verified: Confirmed: version 0.0.0, no tags, no engines or packageManager field, no .nvmrc, and five npm scripts with no typecheck, coverage or format entry.

#### F087 · Low · S3 Enterprise · effort S · priority 3/10

**Dead dependency and dead code: date-fns is never imported, and several exports and state fields have no consumer**

- Where: `frontend/package.json:22`
- Evidence: frontend/package.json:22 `"date-fns": "^4.4.0",` — `grep -rn "date-fns" src` returns no matches; the built bundle contains 0 occurrences of `formatDistance`. yarn.lock resolves it (569 packages in the audit baseline).
- Problem: Dead dependency. Tree-shaking means it costs nothing in the bundle, but it is installed on every CI run (cloudbuild/frontend.yaml:30) and in the Docker builder stage, and it widens the `yarn audit` and Dependabot surface for no benefit.
- Impact: Install time and supply-chain surface only; no user-visible effect. Cheap hygiene that also stops reviewers assuming date formatting is centralised somewhere.
- Fix: `yarn remove date-fns`. If lap/session timestamps later need formatting, prefer `Intl.DateTimeFormat` (zero bytes) or re-add `date-fns` with named submodule imports at that time.
- Verified: Confirmed by grep: date-fns is never imported; searchSessions has no consumer; sessionLaps exists as state only to be mirrored into a ref.

#### F073 · Low · S3 Enterprise · effort S · priority 3/10

**Cloud Build re-runs lint+test after merge (duplicating the PR gate) and pays a C++ toolchain install on every deploy solely for the canvas test**

- Where: `frontend/cloudbuild/frontend.yaml:30`
- Evidence: ../cloudbuild/frontend.yaml:30-45 # 2. ESLint Check - name: 'node:26-alpine' id: 'lint' entrypoint: 'yarn' args: ['lint'] dir: 'frontend' # 3. Unit Tests ... apk add --no-cache cairo pango libjpeg-turbo giflib librsvg \…
- Problem: The pipeline runs lint and tests a second time on the merged SHA (steps 2-3) while skipping the one check the PR lacks until the finding above is fixed (typecheck happens inside step 4 only). Steps 1 and 3 are also serialised, sequential `node:26-alpine` containers, each doing `apk add` — that is ~2 min of toolchain install plus a node-gyp compile of `canvas` every deploy, for a test that duplicates `circuitProjection.test.ts`. The duplication is currently the only *enforced* gate because branch protection is unavailable on this private repo (gh 403), which is worth recognising before removing it.
- Impact: Slower deploys to dev/uat/prod and a native compile step that can break on an Alpine package bump independently of any app change; ambiguity over which pipeline is the source of truth.
- Fix: Two-step plan. (1) Fix the PR gate first (typecheck + build + size findings) and enable branch protection requiring it. (2) Then slim frontend.yaml to: install (`yarn install --frozen-lockfile --ignore-scripts` once `canvas` is removed, no apk toolchain), `yarn build --mode ${_ENV}`, docker build/push, deploy — i.e. delete steps 2-3. If branch protection cannot be enabled, keep a single `yarn typecheck && yarn test:ci` step but drop the apk lines by removing node-canvas (visual finding). Also add `timeout: '900s'` and `options.machineType: 'E2_HIGHCPU_8'` so the build is not the slowest path, and consider `availableSecrets`-free `--mode` usage is fine since the .env.* files are public SPA values.
- Verified: Confirmed: Cloud Build repeats lint and test after merge and installs a C++ toolchain each deploy for the canvas addon.

#### F074 · Low · S3 Enterprise · effort M · priority 3/10

**Frontend deploy shifts 100 % traffic immediately with no smoke test, canary or automated rollback (unlike the api-gateway pipeline)**

- Where: `frontend/cloudbuild/frontend.yaml:88`
- Evidence: cloudbuild/frontend.yaml:85-97 # 6. Deploy to Cloud Run (immutable SHA tag) - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk:583.0.0' id: 'deploy' entrypoint: 'gcloud' args: - 'run' - 'services' - 'update' - 'f1v-webap…
- Problem: The pipeline ends at `gcloud run services update`, which routes all traffic to the new revision as soon as it passes the default TCP probe. There is no curl of the new revision (index.html 200, `/healthz`, correct `Content-Security-Policy` header), no `--no-traffic` canary, and no rollback step. The Terragrunt definition pins `:latest-prod`, so a later `terragrunt apply` can also silently re-deploy whatever that mutable tag points at.
- Impact: A build that produces an empty or broken `dist/` (e.g. the `tsc -b` step is not run in PR checks per the shared context) reaches 100 % of users instantly; recovery is a manual console action. IaC drift between the SHA-tag deploy and the `latest-prod` pin makes 'what is running in prod' ambiguous during an incident.
- Fix:

  ```yaml
    - id: deploy-no-traffic
      args: ['run','deploy','f1v-webapp-${_ENV}','--image=$$IMAGE:${_SHORT_SHA}','--no-traffic','--tag=sha-${_SHORT_SHA}','--region=${_REGION}']
    - id: smoke
      entrypoint: bash
      args: ['-c', 'URL=$(gcloud run services describe f1v-webapp-${_ENV} --format="value(status.traffic[0].url)" ...); curl -fsS "$$URL/healthz" && curl -fsS "$$URL/" | grep -q "<div id=\"root\">" && curl -sI "$$URL/" | grep -qi "content-security-policy"']
    - id: promote
      args: ['run','services','update-traffic','f1v-webapp-${_ENV}','--to-latest','--region=${_REGION}']
  ```
  Set `image_url` in Terragrunt to the SHA tag via a variable (or `ignore_changes = [template[0].containers[0].image]`) so IaC does not fight CI, and add a Cloud Monitoring alert on 5xx ratio for the frontend backend service that pages before users do.

- Verified: Confirmed: the deploy step updates the service with 100 percent traffic and no smoke check.

#### F090 · Low · S3 Enterprise · effort M · priority 3/10

**Four independent copies of the cycling-status-message + shimmer-bar loading pattern (HeadToHeadLoader 610 LOC is presentational, not a fetch container)**

- Where: `frontend/src/components/HeadToHeadLoader.tsx:64`
- Evidence: HeadToHeadLoader.tsx:64-72 const [msgIdx, setMsgIdx] = useState(0); useEffect(() => { const id = setInterval( () => setMsgIdx((p) => (p + 1) % STATUS_MESSAGES.length), 2200, ); return () => clearInterval(id); }, []); Da…
- Problem: HeadToHeadLoader (610 LOC) and DataVaultLoader (328 LOC) are large because every primitive — cycling label, shimmer bar, pulsing placeholder block, ghost driver card — is inlined and then copied to the next loader. There is no `components/ui/` layer of small primitives. The 2200 ms cadence, the 0.25 s fade and the status-label typography are magic values repeated in each copy.
- Impact: Every new page needs a fresh 300-600 line loader; a UX tweak to the loading feel (e.g. slowing the cadence or respecting prefers-reduced-motion, which only the splash honours at useSplashSequence.ts:29-31) must be made in four files.
- Fix: Extract `src/components/ui/`: `useCyclingIndex(length, intervalMs = 2200)`, `<CyclingStatusLabel messages={...} />` (owns the AnimatePresence block and the reduced-motion check), `<ShimmerBar />`, `<GhostBlock width height delay />`, and `<GhostDriverCard side="left"|"right" colour />`. HeadToHeadLoader shrinks to ~150 lines of ghost-radar geometry; DataVaultLoader to ~120. Move `HeadToHeadLoader` into `components/versus/` (its only consumer is VersusMode.tsx:7) and `DataVaultLoader` next to LapTimeChart.
- Verified: Confirmed: the cycling caption and shimmer primitives are copied across four loaders.

#### F078 · Low · S3 Enterprise · effort S · priority 3/10

**Only raw-HTML sink in the app: d3 `.html()` interpolates API-supplied driver name and colour into markup and a style attribute**

- Where: `frontend/src/components/LapTimeChart.tsx:155`
- Evidence: src/components/LapTimeChart.tsx:151-155: ``` const color = getDriverColor(d.driverNumber, driverIdx, driverColorMap); const driverLabel = driverLabelMap?.[d.driverNumber] ?? `#${d.driverNumber}`; tooltip .style("opacity…
- Problem: `driverLabel` and `color` originate from the session roster endpoint, which is fed by third-party F1 timing data (OpenF1) via the backend. They are concatenated into an HTML string and assigned via d3's `.html()` (i.e. `innerHTML`). The strict `script-src 'self'` CSP blocks script execution, but HTML injection (tooltip content/UI redress via `<img>`/`<a>`), style-attribute injection, and — more practically — this single call is what blocks adopting `require-trusted-types-for 'script'` for the whole app (React 19 without `dangerouslySetInnerHTML` and Emotion's `insertRule` path are already TT-clean).
- Impact: Exploitability today is low (requires poisoned upstream data or a compromised backend), but it is the app's only injection sink and it stands between the current CSP and a Trusted Types policy that would make DOM-XSS structurally impossible.
- Fix:

  Build the tooltip with DOM APIs instead of a string:
  ```ts
  tooltip.style('opacity', 1).selectAll('*').remove();
  tooltip.append('strong').style('color', color).text(driverLabel);
  tooltip.append('span').text(` Lap ${d.lapNumber}`);
  tooltip.append('br');
  tooltip.append('span').text(`${d.lapDuration!.toFixed(3)}s`);
  ```
  Then add `require-trusted-types-for 'script'; trusted-types 'none'` to the CSP in nginx.conf:72 (verify in dev with `Content-Security-Policy-Report-Only` first — SockJS iframe transports would be the only expected offender and are never selected when WebSocket is available).

- Verified: Confirmed: LapTimeChart.tsx:155 interpolates the driver label and colour into an .html() call; script-src 'self' blocks script execution so the exposure is markup injection only. Lowered from medium.

#### F079 · Low · S3 Enterprise · effort S · priority 3/10

**nginx omits X-Frame-Options, COOP, CORP, `server_tokens off`, and CSP reporting**

- Where: `frontend/nginx.conf:72`
- Evidence: nginx.conf:72-76 declares exactly five headers: ``` add_header Content-Security-Policy "... frame-ancestors 'none'; ..." always; add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; add_hea…
- Problem: (a) `server_tokens` defaults to `on` in nginx, so `Server: nginx/1.x.y` is advertised on every response and on error pages. (b) `frame-ancestors 'none'` is correct for modern browsers but there is no `X-Frame-Options: DENY` fallback for legacy UAs and security scanners (Mozilla Observatory, OWASP ZAP) still flag its absence. (c) No `Cross-Origin-Opener-Policy: same-origin`, so a page that opened this app via `window.open` keeps a handle to it; the app uses redirect login (Landing.tsx:36 `loginWithRedirect()`), not popups, so `same-origin` is safe. (d) No `Cross-Origin-Resource-Policy`, so the hashed JS bundle can be embedded cross-site. (e) HSTS lacks `preload`, and the CSP has no `report-to`/`report-uri`, so violations (e.g. a SockJS iframe fallback, a future Emotion change) are invisible in production.
- Impact: Mostly defence-in-depth, but each is a one-line change that scanners and enterprise security questionnaires check, and CSP reporting is the only way to learn that the fairly strict policy is breaking a real user.
- Fix:

  Add inside the `server {}` block (keep them at server level so the asset location inherits them, per the existing comment at nginx.conf:57-61):
  ```nginx
  server_tokens off;
  add_header X-Frame-Options "DENY" always;
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Resource-Policy "same-origin" always;
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header Reporting-Endpoints "csp=\"https://<your-report-collector>/csp\"" always;
  # and append `; report-to csp` to the CSP string on line 72
  ```
  Submit the domain to hstspreload.org only after confirming all subdomains (api., dev., uat.) are HTTPS-only.

- Verified: Confirmed: server_tokens is at its default and X-Frame-Options, COOP and CORP are absent; frame-ancestors already covers modern browsers. Lowered from medium.

#### F076 · Low · S3 Enterprise · effort S · priority 3/10

**appState.returnTo is passed to navigate() unvalidated, and deep links are dropped on login**

- Where: `frontend/src/App.tsx:202`
- Evidence: src/App.tsx:195-203: ``` const onRedirectCallback = (appState?: { returnTo?: string }) => { ... navigate(appState?.returnTo || '/dashboard'); }; ``` src/App.tsx:146-147: `if (!isAuthenticated) { return <Navigate to="/" …
- Problem: `returnTo` is forwarded to react-router's `navigate()` without checking that it is a same-origin relative path. Today nothing sets `appState`, and auth0-spa-js stores appState in its own transaction (cookie/sessionStorage keyed by `state`), so a remote attacker cannot inject it without XSS — real exploitability is low. However the moment someone wires deep-link preservation (which the current UX needs: a user opening `/versus` unauthenticated always lands on `/dashboard` after login), this line becomes the open-redirect/path-injection point, and `navigate('https://evil')` in RR7 would push a same-origin path while `//evil` throws — both are surprising failure modes.
- Impact: UX loss now (every unauthenticated deep link ends on /dashboard); latent open-redirect footgun later.
- Fix:

  ```tsx
  // RequiredAuth
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/" replace state={{ returnTo: location.pathname + location.search }} />;
  
  // Landing
  const { state } = useLocation();
  void loginWithRedirect({ appState: { returnTo: state?.returnTo } });
  
  // onRedirectCallback
  const safeReturnTo = (p?: string) => p && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') ? p : '/dashboard';
  navigate(safeReturnTo(appState?.returnTo), { replace: true });
  ```

- Verified: Confirmed: returnTo is forwarded to navigate unvalidated; exploitability is low today because nothing sets appState.

#### F082 · Low · S1 Performance · effort S · priority 3/10

**UserContext value object and updatePreferences are recreated on every UserProvider render (React 19 context idiom not used)**

- Where: `frontend/src/context/UserContext.tsx:78`
- Evidence: 68: const handleUpdatePreferences = async (newPrefs: UserPreferences) => { 78: <UserContext.Provider value={{ userProfile, updatePreferences: handleUpdatePreferences, isLoading, error }}> App.tsx:96: const { isAuthentic…
- Problem: A fresh object literal and a fresh async function are passed as the context value each render, so every render of UserProvider (which happens whenever RequiredAuth re-renders on any Auth0 state change, or on showSplash toggle) forces every useUser() consumer — RaceSimulator and UserSettingsModal — to re-render even when userProfile/isLoading/error are unchanged. Today the impact is masked because nothing is memoized anyway, but it makes the memoization recommended in the first finding ineffective for RaceSimulator.
- Impact: Low frequency today; becomes a re-render source for the whole dashboard as soon as memo boundaries are introduced, and it is a well-known React anti-pattern that reviewers will flag.
- Fix: `const updatePreferences = useCallback(async (p) => {...}, []); const value = useMemo(() => ({ userProfile, updatePreferences, isLoading, error }), [userProfile, updatePreferences, isLoading, error]);` and use the React 19 shorthand `<UserContext value={value}>` instead of `<UserContext.Provider>`. (Or enable the React Compiler, which memoizes this automatically.)
- Verified: Confirmed: the context value object and updatePreferences are recreated every render.

#### F095 · Low · S3 Enterprise · effort S · priority 2/10

**Brittle selectors: inline-style CSS, MUI-internal test IDs, and single-letter text matches; tests also surface an unfixed `ownerState` prop-leak warning**

- Where: `frontend/src/components/__tests__/DataVaultLoader.test.tsx:45`
- Evidence: src/components/__tests__/DataVaultLoader.test.tsx:31,45 const paths = container.querySelectorAll('svg path[fill="none"]'); const shimmerDivs = container.querySelectorAll('div[style*="linear-gradient"]'); src/components/…
- Problem: Selectors couple tests to Emotion's serialised inline style, to `@mui/icons-material`'s `data-testid` convention (an implementation detail MUI does not guarantee), and to single characters that will collide as soon as a second 'F' or '1' appears on the page (`getByText` throws on multiple matches). Separately, the UserSettingsModal test surfaces a real bug — MUI 9 passes `ownerState` to the `paper` slot and `motion.div` forwards it to the DOM — but because it is only a console warning it stays green.
- Impact: Refactoring the shimmer to a `LinearProgress`, changing MUI's icon testid, or adding any 'F'/'1' text breaks tests without a behaviour change; the prop-leak warning fires in production consoles (and would be an unknown-attribute hydration error in SSR).
- Fix: Give the shimmer bars `role="progressbar" aria-label="loading"` and query by role; for MediaController add `aria-label={isPlaying ? 'Pause' : 'Play'}` to the IconButton and use `getByRole('button', { name: /pause/i })`; for the title use `screen.getByRole('heading', { name: 'F1 VISUALIZER' })` or `getByLabelText('Loading F1 Visualizer')` (already present via aria-label on the container). Fix the leak: `slots={{ paper: React.forwardRef((p, ref) => { const { ownerState, ...rest } = p; return <motion.div ref={ref} {...rest} /> }) }}` or use `slotProps.paper.component`. Then make unexpected `console.error` fail tests (see act finding).
- Verified: Confirmed: tests query by inline style and MUI-internal test ids.

#### F094 · Low · S3 Enterprise · effort L · priority 2/10

**Folder layout is layer-first with one flat components/ bucket; caching/error ownership is split across api/, context/ and components/ — will not scale to 3x features**

- Where: `frontend/src/api/referenceApi.ts:51`
- Evidence: referenceApi.ts:51-57 (module-level cache singletons, no TTL/invalidation, only clearable by module reset) const FAILURE_COOLDOWN_MS = 3_000; let driversCache: DriverProfile[] | null = null; let driversInflight: Promise…
- Problem: Today's tree is organised by technical layer (api/, hooks/, components/, pages/, utils/, types/) with a flat `components/` bucket that already mixes route-level containers (RaceSimulator), canvas renderers (CircuitTrace), overlays and loaders. Cross-cutting concerns have no home: caching lives in three places with three different strategies; error handling has none (see logging finding); config lives in two api files. Adding a feature today touches api/, hooks/, components/, pages/, types/ and utils/ simultaneously. `versus/` and `splash/` show the team already gravitates to feature folders but only partially.
- Impact: At 3x features the flat components/ folder becomes 30+ files with no ownership signal, page-vs-component becomes arbitrary, and every feature couples to `api/referenceApi.ts` as a growing monolith (already 152 lines / 7 endpoints / 4 caches).
- Fix:

  Move to a feature-sliced layout with thin shared layers and barrel files:
  ```
  src/
    app/                  main.tsx, App.tsx (providers only), router.tsx (createBrowserRouter), theme/{tokens,theme}.ts, config/env.ts
    shared/
      api/                apiClient.ts, schemas.ts (zod), mappers.ts
      realtime/           stompClient.ts, useStompSubscription.ts
      auth/               Auth0ProviderWithNavigate, AxiosAuthInterceptor, StompAuthHandler, RequiredAuth
      ui/                 CyclingStatusLabel, ShimmerBar, GhostBlock, ErrorState, RouteErrorBoundary
      lib/                logger.ts, result.ts
      domain/             driver.ts, session.ts, lap.ts (types + guards like isTimedLap)
    features/
      live/               route.tsx (Component/loader/HydrateFallback), useRaceSession.ts, lapCorrelation.ts, CircuitTrace/, LiveTelemetryPanel.tsx, MediaController.tsx, SessionControlPanel.tsx, api.ts (ingestion + laps), __tests__/
      vault/              route.tsx, LapTimeChart.tsx, DataVaultLoader.tsx, chartScales.ts, api.ts
      versus/             route.tsx, RadarChart.tsx, StatComparisonBar.tsx, HeadToHeadLoader.tsx, radarGeometry.ts, api.ts
      user/               UserContext.tsx, UserSettingsModal.tsx, api.ts
      landing/            Landing.tsx, splash/
    layout/               LayoutMain.tsx, NavButton.tsx
  ```
  Rules: features import from `shared/` and `app/theme`, never from each other (enforce with `eslint-plugin-boundaries` or `import-x/no-restricted-paths`); each feature exports only `route.tsx` via `index.ts`. Replace the three cache strategies with one — either RR7 loaders + a small `createCachedFetch(key, fn, ttl)` in `shared/api`, or TanStack Query (`staleTime` per query replaces `driversCache`/`FAILURE_COOLDOWN_MS`, and `retry` replaces the axios 429 loop). Update README.md:101-131 to match.

- Verified: Confirmed: a layer-first tree with one flat components bucket; an opinion about scale rather than a defect.

#### F092 · Low · S3 Enterprise · effort M · priority 2/10

**No runtime feature flags or kill switches: disabling the live feed, splash or a backend integration requires a rebuild and redeploy**

- Where: `frontend/src/api/apiClient.ts:5`
- Evidence: apiClient.ts:5-11 if (import.meta.env.MODE === 'prod') { targetBaseUrl = 'https://api.f1visualizer.com/api/v1'; } else if (import.meta.env.MODE === 'uat') { ... stompClient.ts:5-11 if (import.meta.env.MODE === 'prod') {…
- Problem: All environment behaviour is compiled in at build time via `import.meta.env.MODE`; there is no `/config.json`, remote-config document or flag SDK. Operational knobs that matter during an incident (turn off STOMP auto-connect during a telemetry outage, skip the 7 s splash, shorten the activation delay, point at a fallback API host, show a maintenance banner) cannot be changed without running the Cloud Build pipeline and rolling Cloud Run.
- Impact: Mean time to mitigate for frontend-side workarounds equals a full CI build + deploy, and there is no way to canary a risky behaviour (e.g. the new backoff policy) to a percentage of users.
- Fix: Serve a tiny runtime config from the same origin: `public/config.json` -> `{ "liveFeedEnabled": true, "splashEnabled": true, "maintenanceMessage": null, "apiBaseUrl": null }`, fetched in `main.tsx` before render (`const cfg = await fetch('/config.json', { cache: 'no-store' }).then(r => r.json())`) and provided via a `ConfigContext`; add `location = /config.json { add_header Cache-Control "no-store" always; ... }` in nginx.conf and let ops overwrite the file via a Cloud Run env var + `envsubst` in the container entrypoint (`nginx-unprivileged` supports `/docker-entrypoint.d/*.sh`). Gate `StompAuthHandler` and `SplashScreen` on those flags. For percentage rollouts later, a hosted flag service (GrowthBook/LaunchDarkly) can replace the file with the same context API.
- Verified: Confirmed: all behaviour is compiled in via import.meta.env.MODE.

#### F096 · Low · S3 Enterprise · effort S · priority 2/10

**Non-null assertions paper over optional types instead of narrowing them**

- Where: `frontend/src/components/LapTimeChart.tsx:97`
- Evidence: LapTimeChart.tsx:61 const validDurations = data.filter(d => d.lapDuration != null && d.lapDuration > 0).map(d => d.lapDuration!); LapTimeChart.tsx:97 .y(d => y(d.lapDuration!)) LapTimeChart.tsx:102 const driverLaps = gr…
- Problem: `LapDataRecord.lapDuration`/`dateStart` are optional on the wire type, and every consumer filters then re-asserts with `!` instead of narrowing once with a type guard. `sessionMeta!` in CircuitTrace depends on an invariant enforced only by the parent's ordering of `setSessionMeta` before `setIsInitializing(true)` (RaceSimulator.tsx:130-131) — a future reorder throws at render and hits the global ErrorBoundary. `d3.min(...)!` at chartScales.ts:102 is undefined for an empty array (LapTimeChart guards this at :62 but chartScales is exported and tested independently).
- Impact: Type system is opted out precisely where wire data is least trusted; refactors can introduce runtime TypeErrors that the compiler was designed to prevent.
- Fix: Introduce `type TimedLap = LapDataRecord & { lapDuration: number; dateStart: string }` with a guard `const isTimedLap = (l: LapDataRecord): l is TimedLap => typeof l.lapDuration === 'number' && l.lapDuration > 0 && !!l.dateStart;` in `utils/laps.ts`; filter once at the API boundary (`fetchSessionLaps` returns `TimedLap[]` after schema parse) so d3 accessors and the lap-correlation code take `TimedLap` and the `!`s vanish. For CircuitTrace, make the loading-overlay props a single `session: { year; meetingName } | null` and render the overlay only when it is non-null, removing `sessionMeta!`. Turn on `@typescript-eslint/no-non-null-assertion` as `warn` to stop new ones.
- Verified: Confirmed by grep: 13 non-null assertions in src, including sessionMeta! in CircuitTrace, which relies on the parent's setState ordering rather than a narrowed type.

## 5. Roadmap

Ordered by priority within each phase. Impact estimates reference §1.4.

### Phase 1: Quick wins (days)

1. **Rewire the STOMP client to the library: ReconnectionTimeMode.EXPONENTIAL with maxReconnectDelay, deactivate() as the breaker, a beforeConnect token provider, TickerStrategy.Worker heartbeats, and a debug hook that is a no-op outside DEV.** — Reconnect storms stop; the bearer token no longer appears in the console; reconnects after token expiry succeed; background tabs stop dropping. _(effort S; F002, F007, F008, F038)_
2. **Enable compression at the load balancer and in nginx, and add a no-cache rule for index.html.** — Wire size falls from about 1,147 kB to 300 to 360 kB; no stale-shell white screens after deploys. _(effort S; F001, F005)_
3. **Render the Landing page without waiting for Auth0, paint a dark background from index.html, and show the login button within the first 600 ms.** — First contentful paint moves from after the Auth0 round-trip to the first frame after the script runs; the white flash disappears. _(effort S; F003)_
4. **Coalesce telemetry per driver in useTelemetry and bound the location queue.** — The selected driver updates every frame it has data; memory stops growing in hidden tabs. _(effort S; F011, F060)_
5. **Remove the wasted backdrop blur and fixed-attachment gradient, move the gradient sweep and stat bars to transforms, and wrap the app in MotionConfig reducedMotion user.** — Removes the largest per-frame paint costs on the dashboard, Versus and Landing pages; honours the OS motion preference everywhere. _(effort S; F010, F014, F029, F015)_
6. **Add typecheck, build and a size-limit budget to the PR job; set CI=true in Cloud Build tests; fix the visual-test tolerance to match the README.** — Type errors and bundle growth stop merging green; the visual test regains meaning. _(effort S; F004, F027, F049)_
7. **Self-host Titillium Web with the faces the design actually uses and drop the Google origins from the CSP.** — Removes a render-blocking third-party request and synthesised bold italics; one fewer third party in the privacy story. _(effort S; F012)_
8. **Pass the focusVisible option to createTheme, name the play/pause button, set component props on value headings, and key the driver-bootstrap effect on the favourite-driver code.** — Keyboard users can see where they are; screen readers stop announcing telemetry as headings; saving preferences no longer resets the selected driver. _(effort S; F024, F025, F068, F030)_
9. **Set isolate: false in Vitest and add matchMedia and scrollTo stubs so App.tsx becomes testable.** — Suite runs about 40 percent faster; the routing and auth guard can finally be covered. _(effort S; F072, F048)_

### Phase 2: Short term (1 to 3 weeks)

1. **Lazy-load the three authenticated routes, move StompAuthHandler under RequiredAuth, and define codeSplitting groups for react, mui, auth0, motion and d3.** — Landing JS roughly a third of today; vendor chunks survive app-only deploys in the cache. _(effort M; F006)_
2. **Mount the app behind the splash, finish it when prefetches settle (2 s minimum, 7 s cap), make it skippable, and surface prefetch failures.** — Time to an interactive dashboard after login drops from 7.5 s plus load to whichever is longer of 2 s and the data. _(effort M; F009)_
3. **Move per-tick state into a LiveTelemetryPanel, memoise siblings, precompute a per-driver lap index, and commit readouts at 10 Hz with tabular figures.** — The dashboard tree stops reconciling 60 times per second; readouts stop jittering. _(effort M; F016, F041, F040)_
4. **Rework CircuitTrace: affine projection, offscreen history layer, ring-buffered history, dirty flag, devicePixelRatio scaling, computeBounds on driver switch, and wire in the tested utils.** — Frame cost becomes flat over a session instead of growing; crisp lines on HiDPI; no zoom artefact when switching drivers. _(effort M; F017, F031, F042, F043)_
5. **Replace the mode=wait route wrapper with useOutlet or popLayout, or React Router viewTransition, and persist page selections in search params.** — Pages mount immediately on navigation and stop double-mounting; back and forward restore state. _(effort S; F022)_
6. **Enable refresh tokens with rotation, fail closed on login_required and consent_required, and re-authenticate on 401.** — Silent renewal works with third-party cookies blocked; token failures become a login prompt instead of a page of failed requests. _(effort M; F019, F013)_
7. **Replace the ad-hoc interceptor with an idempotent-only retry policy honouring Retry-After, add a 15 s timeout, thread AbortSignal through the API layer, and validate responses with a schema library at the boundary.** — No duplicated playback commands; abandoned requests stop retrying; wire drift fails loudly. _(effort M; F020, F021, F034)_
8. **Add error and empty states to every loader, a scoped logger with a production sink, global error handlers, a nested route boundary, and a connection-status store.** — Failures become visible to users and operators; the connection chips and banner tell the truth. _(effort M; F018, F046, F023, F028)_
9. **Accessibility pass: canvas and chart alternatives, landmarks and skip link, per-route titles and focus, contrast tokens, focus retention on pending buttons, dialog and header reflow at 375 px.** — The console becomes operable by keyboard and screen reader and usable on a phone. _(effort M; F051, F065, F069, F067, F052, F053, F054)_
10. **Type-aware ESLint with jsx-a11y and import rules, Prettier and EditorConfig, Dependabot for npm, docker and actions, digest-pinned images, and coverage thresholds.** — Async bugs and accessibility regressions are caught at lint time; dependencies and images stop drifting silently. _(effort M; F026, F056, F033, F032, F050)_

### Phase 3: Strategic (1 to 2 quarters)

1. **Adopt a server-state layer (TanStack Query or route loaders with lazy route modules) with typed, validated env config.** — One caching strategy with invalidation and cancellation; loaders run during navigation instead of after mount. _(effort L; F035, F036)_
2. **Drop SockJS for a native WebSocket once the gateway is confirmed to forward /ws/websocket.** — Removes an unmaintained dependency, the global shim and the /ws/info handshake that competes for rate-limit budget. _(effort M; F037)_
3. **Decompose RaceSimulator into a session reducer, a lap-correlation module and presentational panels; centralise colour and motion tokens; extract loader primitives; move toward feature slices.** — New live-console features stop touching a 375-line file; one visual and motion vocabulary across the app. _(effort L; F057, F058, F059, F090, F094)_
4. **Add a Playwright layer with axe checks at desktop and mobile widths, and Lighthouse CI on the public landing route.** — The auth handshake, STOMP reconnect and canvas resize are exercised before production; accessibility and performance regressions are gated. _(effort L; F066, F070)_
5. **Enable the React Compiler through the Vite plugin and switch to LazyMotion with domMax.** — Automatic memoisation of the remaining identity churn; roughly 100 kB less motion code in the entry chunk. _(effort M; F071, F086)_
6. **Stamp the build with the commit, emit hidden source maps, collect web-vitals, add a health endpoint and JSON access logs, deploy with a no-traffic smoke test, and cut releases with release-please.** — Production errors become symbolicated and attributable; field performance is measured; bad deploys are caught before traffic shifts. _(effort M; F047, F075, F062, F074, F088)_

## 6. Strengths to preserve (do not regress)

- Real-time architecture: GPS points bypass React state through a lock-free queue drained inside the rAF loop, telemetry is rAF-coalesced, and the seek race is closed with a layout-effect-mirrored reset key. The reasoning is written down in the code.
- Strict TypeScript posture with zero any in production source and a clean pass of the compiler-era react-hooks rule set, which is a strong signal the code is React Compiler-safe.
- nginx security posture that is unusually complete: strict CSP with per-host connect-src and frame-src maps, HSTS, Permissions-Policy, header inheritance documented, and a non-root image that contains only the bundle and its config.
- Request deduplication with in-flight promise sharing and a failure cooldown in the reference API, plus a deliberately staggered prefetch during the splash to avoid tripping the gateway rate limiter.
- 188 behavioural tests with no snapshot overuse, race-condition tests that encode real production bugs, and pure projection and chart maths extracted into unit-tested utilities.
- Shape-matched skeletons for the Data Vault and Versus pages, compositor-friendly transforms in most entrance animations, and a polished FLIP-based navigation underline.
- Tokens stay in memory rather than localStorage, there is no dangerouslySetInnerHTML anywhere, query parameters are encoded, and the app refuses to render without its Auth0 configuration.
- Dependencies are current across the board, the README is accurate and genuinely useful for onboarding, and commits already follow Conventional Commits, so automated releases are one action away.

## 7. Trade-offs and open questions

- Code splitting versus the splash prefetch: lazy routes add one request on first navigation. Warm the dashboard chunk with a dynamic import during the splash so the change is invisible.
- Removing backdrop blur changes the AppBar if it stays translucent; the 15 Papers are unaffected because they are already opaque. Decide the AppBar look once and keep it.
- Refresh tokens require tenant configuration (rotation, offline_access). Test the reload path in Safari and in Chrome with third-party cookies blocked before shipping.
- Dropping SockJS depends on the API gateway forwarding /ws/websocket. Keep SockJS until that is verified in dev.
- isolate: false in Vitest relies on tests resetting module state; an order-dependent failure would show up as flakiness. Keep the option behind a quick revert.
- Type-aware ESLint will surface existing floating-promise warnings. Land it with warnings allowed, fix in batches, then enforce max-warnings 0.
- Shortening or skipping the splash trades a brand moment for time to interaction. A 2 s minimum keeps the moment without gating the app.
- The compression finding could not be observed on the deployed host from this sandbox. Confirm with the curl in the appendix before scheduling the change.

## 8. Set aside during verification

Raw observations that did not become findings, kept for transparency:

- OffscreenCanvas + worker is feasible for this loop but is a larger refactor than the cached-layer fix; recommend as follow-up only — Not a finding: a note deferring OffscreenCanvas until cheaper canvas fixes land; folded into the canvas finding.
- nginx `server_name localhost` and no component workshop/docs for a visual-heavy component library — server_name localhost is harmless with a single server block; the component-workshop suggestion is a wish, not a defect.
- README claims are hand-maintained in two places and one ("60fps") is unmeasured — README claims were spot-checked and are accurate today; only the unmeasured '60fps' wording remains, which is cosmetic.
- Access token is re-acquired inside the axios interceptor on every request, serialising the splash prefetch burst on the auth0-spa-js lock — Recommended cacheLocation: 'localstorage' for tokens, which contradicts the security finding; the performance concern is addressed by refresh tokens in the Auth0 finding.

## 9. Reproduction and verification commands

```bash
cd frontend
yarn install --frozen-lockfile
yarn lint
yarn tsc -b                              # typecheck (not run by the PR gate today: F004)
yarn test:ci
yarn build --mode prod                   # baseline: 1 chunk, 1,146.9 kB / 358.4 kB gzip
yarn vite build --mode prod --sourcemap --outDir /tmp/dist-sm   # for composition analysis via the source map
yarn vite preview --port 4173            # serve dist/ locally
# Confirm compression on the deployed host (F001) — expect content-encoding: br or gzip after the fix:
curl -sI -H 'Accept-Encoding: br, gzip' "https://f1visualizer.com$(curl -s https://f1visualizer.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)" | grep -iE 'content-(encoding|length)|cache-control'
# Confirm the shell cache policy (F005) — expect Cache-Control: no-cache after the fix:
curl -sI https://f1visualizer.com/ | grep -iE 'cache-control|etag|last-modified'
```

### Acceptance targets after the quick wins

- Wire size of the entry JS ≤ 360 kB (gzip) or ≤ 310 kB (brotli); `Cache-Control: no-cache` on `/` and `/index.html`.
- Landing page: first contentful paint before the Auth0 session check resolves; no white frame; login button visible within 600 ms of script execution.
- STOMP: with the telemetry service stopped, reconnect intervals grow 5 s → 60 s and stop after the breaker; no `Authorization` header in the console; reconnect after token expiry succeeds.
- Dashboard: the selected driver readout updates on every frame that carries its packet; no `backdrop-filter` in computed styles of Paper elements; `prefers-reduced-motion: reduce` stops all infinite loops.
- CI: PR job runs typecheck, build and a size budget; visual snapshots use a pixel or 0.0001 percent threshold matching the README.

---

_Generated from the same curated data as the interactive report. Method: 11 dimension-specific finder agents produced 150 raw findings; they were merged into 96 canonical findings, each checked against the source and the installed libraries, then synthesised into the scorecard, themes and roadmap above. Limitations: the deployed hosts were unreachable from the audit sandbox (compression inferred from config, not observed); the authenticated dashboard was not profiled live; frame-rate sampling of the landing page was not possible in a hidden browser pane._
