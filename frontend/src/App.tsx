import React from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Security } from '@okta/okta-react';
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js';
import LayoutMain from './components/layout/LayoutMain';
import { AxiosAuthInterceptor } from './auth/AuthHandler';

// --- OKTA CONFIGURATION ---
// PlACE-HOLDERS for initial dev-purposes, OKTA ISS and CLIENT_ID
const oktaAuth = new OktaAuth({
    issuer: 'YOUR_TENANT_HERE',
    clientId: 'YOUR_CLIENT_ID_HERE',
    redirectUri: window.location.origin + '/login/callback',
    scopes: ['openid', 'profile', 'email']
});

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#e10600' },
        secondary: { main: '#FF8700' },
        background: { default: '#121212', paper: '#1e1e1e' },
        text: { primary: '#ffffff', secondary: '#b0b0b0' },
    },
    typography: {
        fontFamily: '"Titillium Web", "Roboto", "Helvetica", "Arial", sans-serif',
        h4: { textTransform: 'uppercase', letterSpacing: '0.05em' },
        h6: { textTransform: 'uppercase' }
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: { backgroundColor: '#181818' }
            }
        }
    }
});

const AppWithRouterAccess: React.FC = () => {
    const navigate = useNavigate();
    const restoreOriginalUri = async (_oktaAuth: any, originalUri: string) => {
        navigate(toRelativeUrl(originalUri || '/', window.location.origin));
    };
    return (
        <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
            <AxiosAuthInterceptor />
            <LayoutMain />
        </Security>
    );
};

function App() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <BrowserRouter>
                <AppWithRouterAccess />
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;