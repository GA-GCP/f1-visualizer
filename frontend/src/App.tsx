import React, { useEffect, useState } from 'react';
import { Routes, Route, Outlet, BrowserRouter, useNavigate, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { AnimatePresence, motion } from 'framer-motion';
import LayoutMain from './components/layout/LayoutMain';
import ErrorBoundary from './components/ErrorBoundary';
import { AxiosAuthInterceptor } from './auth/AuthHandler';
import { StompAuthHandler } from './auth/StompAuthHandler';
import SplashScreen from './components/splash/SplashScreen';
import Home from './pages/Home';
import HistoricalData from './pages/HistoricalData';
import VersusMode from './pages/VersusMode';
import { UserProvider } from "@/context/UserContext.tsx";
import { fetchDrivers, fetchSessions } from './api/referenceApi';
import Landing from './pages/Landing';

// --- THE BROADCAST THEME ---
const broadcastTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#e10600' },
        secondary: { main: '#ffffff' },
        background: {
            default: '#101010',
            paper: 'rgba(20, 20, 20, 0.6)'
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255,255,255,0.7)',
        },
    },
    typography: {
        fontFamily: '"Titillium Web", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.02em' },
        h4: { fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.05em' },
        h6: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' },
        body1: { fontSize: '1.1rem' },
    },
    shape: { borderRadius: 4 },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 100%)',
                    backgroundAttachment: 'fixed',
                    minHeight: '100vh',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(30, 30, 30, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '2px solid #e10600',
                    boxShadow: 'none',
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '1px solid rgba(255,255,255,0.2)',
                }
            },
            variants: [
                {
                    props: { variant: 'filled', color: 'success' },
                    style: {
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        color: '#00ff00',
                        border: '1px solid #00ff00',
                        boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)',
                    }
                }
            ]
        }
    }
});

// --- AUTH GUARD COMPONENT ---
const RequiredAuth: React.FC = () => {
    // 1. Destructure the 'error' object from Auth0
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
            return () => clearTimeout(tid);
        }
    }, [showSplash, isAuthenticated]);

    if (isLoading) {
        return null;
    }

    // 3. Gracefully display the error to stop the infinite loop
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
                        <Outlet />
                    </motion.div>
                )}
            </AnimatePresence>
        </UserProvider>
    );
};

// --- LANDING GATE (public root route) ---
// Shows the Landing page for unauthenticated visitors; redirects to /dashboard if already logged in.
const LandingGate: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth0();

    if (isLoading) {
        return null;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Landing />;
};

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
            <BrowserRouter>
                <Auth0ProviderWithNavigate>
                    <AxiosAuthInterceptor />
                    <StompAuthHandler />
                    <ErrorBoundary>
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
                    </ErrorBoundary>
                </Auth0ProviderWithNavigate>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;