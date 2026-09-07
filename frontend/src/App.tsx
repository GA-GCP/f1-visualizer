import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Outlet, BrowserRouter, useNavigate, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import { AxiosAuthInterceptor } from './auth/AuthHandler';
import SplashScreen from './components/splash/SplashScreen';
import RouteFallback from './components/ui/RouteFallback';
import { UserProvider } from "@/context/UserContext.tsx";
import { fetchDrivers, fetchSessions } from './api/referenceApi';
import Landing from './pages/Landing';
import { broadcastTheme } from './theme/theme';

// --- DEFERRED AUTHENTICATED CODE ---
// None of this can render before login, yet all of it used to ship in the one
// chunk the public Landing page downloads: d3, the canvas trace, the lap and
// radar charts, Autocomplete/Dialog/Slider/Snackbar, and the STOMP + SockJS
// stack. Splitting it out is purely a matter of importing it dynamically —
// Vite/rolldown already chunks on dynamic import().
//
// The factories are named so the same specifier is used for both lazy() and the
// splash prefetch, and the browser reuses the one chunk.
const importLayoutMain = () => import('./components/layout/LayoutMain');
const importHome = () => import('./pages/Home');
const importHistoricalData = () => import('./pages/HistoricalData');
const importVersusMode = () => import('./pages/VersusMode');

const LayoutMain = lazy(importLayoutMain);
const Home = lazy(importHome);
const HistoricalData = lazy(importHistoricalData);
const VersusMode = lazy(importVersusMode);

// Renders null, so it needs no fallback — but it must not be imported
// statically or the whole WebSocket stack stays on the public route.
const StompAuthHandler = lazy(() =>
    import('./auth/StompAuthHandler').then(m => ({ default: m.StompAuthHandler })),
);

// --- AUTH GUARD COMPONENT ---
const RequiredAuth: React.FC = () => {
    const { isAuthenticated, isLoading, error } = useAuth0();

    // Post-login splash: read a sessionStorage flag set by onRedirectCallback.
    // With the Landing page routing, RequiredAuth only mounts AFTER navigate('/dashboard'),
    // so the flag is guaranteed to be set by the time this initializer runs.
    // (The old DOM-event approach no longer works because RequiredAuth isn't mounted
    // when onRedirectCallback fires — it lives on /dashboard while the callback lands on /.)
    const [showSplash, setShowSplash] = useState(() => {
        const flag = sessionStorage.getItem('f1v:post-login');
        if (flag) {
            sessionStorage.removeItem('f1v:post-login');
            return true;
        }
        return false;
    });

    // Prefetch reference data during the splash screen animation.
    // The splash runs for ~7 seconds — plenty of time for these API calls
    // to resolve and populate the in-memory cache in referenceApi.ts.
    // When components mount after splash, they hit the cache instantly,
    // eliminating the CircularProgress / Skeleton loading states.
    // Note: AxiosAuthInterceptor is already mounted (sibling above this
    // component), so these requests will have the Auth0 JWT attached.
    //
    // Calls are staggered by 400ms to avoid a simultaneous OPTIONS preflight
    // burst that can trigger the API Gateway rate limiter (429), which then
    // cascades into CORS failures and blocks the STOMP WebSocket handshake.
    useEffect(() => {
        if (showSplash && isAuthenticated) {
            void fetchDrivers();
            const tid = setTimeout(() => void fetchSessions(), 400);

            // Warm the route chunks behind the splash so the split costs no
            // visible time. These are same-origin static assets, not API calls,
            // so they need no stagger — only an ordering, so the shell and the
            // landing route win the race for bandwidth.
            void importLayoutMain();
            void importHome();
            const chunkTid = setTimeout(() => {
                void importHistoricalData();
                void importVersusMode();
            }, 1000);

            return () => {
                clearTimeout(tid);
                clearTimeout(chunkTid);
            };
        }
    }, [showSplash, isAuthenticated]);

    if (isLoading) {
        return null;
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ff4444', fontFamily: 'sans-serif' }}>
                <h2>Authentication Error</h2>
                <p>{error.message}</p>
                <p style={{ fontSize: '0.8rem', color: '#888' }}>Check your Auth0 Dashboard and .env configuration.</p>
            </div>
        );
    }

    // Redirect unauthenticated users to the public landing page
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <UserProvider>
            {/* Mounted here rather than at the app root: the WebSocket stack is
                useless before login, and mounting it under the guard is what
                keeps it out of the public route's chunk. */}
            <Suspense fallback={null}>
                <StompAuthHandler />
            </Suspense>

            <AnimatePresence mode="wait">
                {showSplash ? (
                    <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
                ) : (
                    <motion.div
                        key="app-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Covers the shell chunk itself; LayoutMain carries its
                            own boundary for the page chunks under it. */}
                        <Suspense fallback={<RouteFallback />}>
                            <Outlet />
                        </Suspense>
                    </motion.div>
                )}
            </AnimatePresence>
        </UserProvider>
    );
};

// --- LANDING GATE (public root route) ---
// Shows the Landing page for unauthenticated visitors; redirects to /dashboard if already logged in.
const LandingGate: React.FC = () => {
    const { isAuthenticated } = useAuth0();

    // Deliberately NOT gated on `isLoading`.  Auth0's loading flag exists to
    // gate *protected* content; this page has none, so waiting for
    // checkSession() to finish its iframe round-trip to the tenant just holds a
    // blank screen on the only public page.  Render immediately and let the
    // redirect happen underneath once the session resolves as authenticated.
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Landing />;
};

// --- ROUTE TREE ---
// Exported separately from <App /> so a test can mount it inside its own
// router and auth mock without booting BrowserRouter or Auth0Provider.
export const AppRoutes: React.FC = () => (
    <Routes>
        {/* Public landing page — outside the auth guard */}
        <Route path="/" element={<LandingGate />} />

        {/* Protected app routes */}
        <Route element={<RequiredAuth />}>
            <Route element={<LayoutMain />}>
                <Route path="/dashboard" element={<Home />} />
                <Route path="/historical" element={<HistoricalData />} />
                <Route path="/versus" element={<VersusMode />} />
            </Route>
        </Route>
    </Routes>
);

// --- AUTH0 PROVIDER WRAPPER ---
// We wrap this inside BrowserRouter so we can use useNavigate for the Auth0 callback redirect
const Auth0ProviderWithNavigate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();

    const domain = import.meta.env.VITE_AUTH0_DOMAIN;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    const onRedirectCallback = (appState?: { returnTo?: string }) => {
        // Signal to RequiredAuth that it should show the post-login splash.
        // We use sessionStorage instead of a DOM event because RequiredAuth
        // is NOT mounted yet at this point — it lives on /dashboard, but the
        // Auth0 callback lands on /.  The flag survives the navigate() call
        // and is read (then cleared) when RequiredAuth mounts.
        sessionStorage.setItem('f1v:post-login', '1');
        navigate(appState?.returnTo || '/dashboard');
    };

    if (!(domain && clientId && audience)) {
        return null;
    }

    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: audience
            }}
            onRedirectCallback={onRedirectCallback}
        >
            {children}
        </Auth0Provider>
    );
};

function App() {
    return (
        <ThemeProvider theme={broadcastTheme}>
            <CssBaseline />
            {/* Every framer animation in the tree respects prefers-reduced-motion:
                transform and layout animations are dropped, opacity is kept. */}
            <MotionConfig reducedMotion="user">
            <BrowserRouter>
                <Auth0ProviderWithNavigate>
                    <AxiosAuthInterceptor />
                    <ErrorBoundary>
                        <AppRoutes />
                    </ErrorBoundary>
                </Auth0ProviderWithNavigate>
            </BrowserRouter>
            </MotionConfig>
        </ThemeProvider>
    );
}

export default App;