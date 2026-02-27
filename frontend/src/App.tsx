import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom'; // Add Routes, Route, Outlet to your existing react-router-dom imports
import { LoginCallback, useOktaAuth } from '@okta/okta-react'; // Add LoginCallback and useOktaAuth
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Security } from '@okta/okta-react';
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js';
import LayoutMain from './components/layout/LayoutMain';
import { AxiosAuthInterceptor } from './auth/AuthHandler';
import Home from './pages/Home';
import HistoricalData from './pages/HistoricalData';
import VersusMode from './pages/VersusMode';

// --- DYNAMIC OKTA CONFIGURATION ---
const oktaAuth = new OktaAuth({
    issuer: import.meta.env.VITE_OKTA_ISSUER,
    clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
    redirectUri: window.location.origin + '/login/callback',
    scopes: ['openid', 'profile', 'email']
});

// --- THE BROADCAST THEME ---
const broadcastTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#e10600' }, // F1 Crimson
        secondary: { main: '#ffffff' }, // Pure White for contrast
        background: {
            default: '#101010', // Deep dark, almost black
            paper: 'rgba(20, 20, 20, 0.6)' // Glass base
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
    shape: {
        borderRadius: 4, // Subtle rounding, but we will often override this
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    // Global dark radial gradient to give it depth (like a TV studio background)
                    background: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 100%)',
                    backgroundAttachment: 'fixed',
                    minHeight: '100vh',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    // THE GLASS EFFECT
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
                    background: 'rgba(0, 0, 0, 0.8)', // Darker glass for header
                    backdropFilter: 'blur(20px)',
                    borderBottom: '2px solid #e10600', // The "Red Line" signature
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
                        boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)', // Neon Glow
                    }
                }
            ]
        }
    }
});

// --- AUTH GUARD COMPONENT ---
// This checks if the user is logged in. If not, it kicks them to Okta.
const RequiredAuth: React.FC = () => {
    const { oktaAuth, authState } = useOktaAuth();

    React.useEffect(() => {
        if (!authState) return;
        if (!authState.isAuthenticated) {
            oktaAuth.signInWithRedirect();
        }
    }, [oktaAuth, authState]);

    if (!authState || !authState.isAuthenticated) {
        return null; // Show nothing while redirecting to Okta
    }

    // If authenticated, render the child routes
    return <Outlet />;
};

const AppWithRouterAccess: React.FC = () => {
    const navigate = useNavigate();

    const restoreOriginalUri = async (_oktaAuth: OktaAuth, originalUri: string) => {
        navigate(toRelativeUrl(originalUri || '/', window.location.origin));
    };

    return (
        <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
            <AxiosAuthInterceptor />
            <Routes>
                {/* 1. The Okta Callback Route (Must be unprotected) */}
                <Route path="/login/callback" element={<LoginCallback />} />

                {/* 2. Protected Application Routes */}
                <Route element={<RequiredAuth />}>
                    <Route element={<LayoutMain />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/historical" element={<HistoricalData />} />
                        <Route path="/versus" element={<VersusMode />} />
                    </Route>
                </Route>
            </Routes>
        </Security>
    );
};

function App() {
    return (
        <ThemeProvider theme={broadcastTheme}>
            <CssBaseline />
            <BrowserRouter>
                <AppWithRouterAccess />
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;