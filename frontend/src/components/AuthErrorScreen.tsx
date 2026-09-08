import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { createLogger } from '../lib/logger';
import { BRAND_RED } from '../theme/tokens';

const log = createLogger('auth');

interface AuthErrorScreenProps {
    /** The raw Auth0 error. Logged, never rendered. */
    error: Error;
    /** Starts a fresh login. */
    onRetry: () => void;
}

/**
 * Shown when the Auth0 redirect callback fails.
 *
 * What was here before rendered `error.message` and the sentence "Check your
 * Auth0 Dashboard and .env configuration" — developer instructions, shown to
 * whoever hit the page. `error` is set for any `?error=...&state=...` URL,
 * which includes a stale bookmark, a back-navigation after signing in, and a
 * crafted link, so an ordinary user could reach it by accident and be told to
 * check a dashboard they cannot open.
 *
 * It was also a dead end: no way back to the app without editing the URL.
 *
 * The raw error still matters to whoever is on call, so it goes to the logger
 * (and from there to whatever sink is configured) rather than to the screen.
 */
const AuthErrorScreen: React.FC<AuthErrorScreenProps> = ({ error, onRetry }) => {
    React.useEffect(() => {
        log.error('Auth0 redirect callback failed', error);
    }, [error]);

    return (
        <Box
            role="alert"
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                px: 3,
                textAlign: 'center',
            }}
        >
            <Typography variant="h5" component="h1" sx={{ color: BRAND_RED, fontWeight: 700 }}>
                Sign-in could not be completed
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 460, color: 'text.secondary' }}>
                This usually means the sign-in link had already been used or had expired. Starting
                again should work.
            </Typography>
            <Button variant="contained" onClick={onRetry} sx={{ mt: 1 }}>
                Sign in again
            </Button>
        </Box>
    );
};

export default AuthErrorScreen;
