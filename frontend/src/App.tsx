import React, { useContext, useEffect, useState } from 'react';
import { Routes, Route, Outlet, BrowserRouter, useNavigate } from 'react-router-dom';
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

// --- POST-LOGIN SPLASH CONTEXT ---
// Lets onRedirectCallback (event handler) signal RequiredAuth to show
// the splash without sessionStorage, refs-during-render, or setState-in-effect.
interface SplashCtx {
    pending: boolean;
    dismiss: () => void;
}
const SplashContext = React.createContext<SplashCtx>({
    pending: false,
    dismiss: () => {},
});

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
    const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
    const { pending: showSplash, dismiss: dismissSplash } = useContext(SplashContext);

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !error) {
            void loginWithRedirect();
        }
    }, [isLoading, isAuthenticated, error, loginWithRedirect]);

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

    if (!isAuthenticated) {
        return null;
    }

    return (
        <UserProvider>
            <AnimatePresence mode="wait">
                {showSplash ? (
                    <SplashScreen key="splash" onComplete={dismissSplash} />
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

// --- AUTH0 PROVIDER WRAPPER ---
// We wrap this inside BrowserRouter so we can use useNavigate for the Auth0 callback redirect
const Auth0ProviderWithNavigate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [splashPending, setSplashPending] = useState(false);

    const domain = import.meta.env.VITE_AUTH0_DOMAIN;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    const onRedirectCallback = (appState?: { returnTo?: string }) => {
        setSplashPending(true);
        navigate(appState?.returnTo || window.location.pathname);
    };

    if (!(domain && clientId && audience)) {
        return null;
    }

    return (
        <SplashContext.Provider
            value={{ pending: splashPending, dismiss: () => setSplashPending(false) }}
        >
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
        </SplashContext.Provider>
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
                            <Route element={<RequiredAuth />}>
                                <Route element={<LayoutMain />}>
                                    <Route path="/" element={<Home />} />
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
