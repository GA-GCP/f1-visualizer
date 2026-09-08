import { Box, Typography, Button, Stack } from '@mui/material';
import { m } from 'framer-motion';
import React from 'react';
import { createLogger } from '../lib/logger';

const log = createLogger('error-boundary');

const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 2000;
/** How long the tree must render cleanly before the retry budget is restored. */
const STABLE_RENDER_MS = 30_000;

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    retryCount: number;
}

/**
 * A resilient ErrorBoundary that attempts in-place recovery before
 * falling back to a full page reload.
 *
 * On first catch it automatically clears its error state after a short
 * delay so React re-mounts the child tree.  This handles the common
 * scenario of a transient failure (e.g. a STOMP subscription firing
 * before the WebSocket handshake completes).  If the same error keeps
 * recurring it stops auto-retrying and presents manual controls.
 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
    private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = { hasError: false, error: null, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        log.error('Uncaught render error', error, info.componentStack);

        // Auto-retry: clear the error state after a delay so React
        // re-renders the child tree.  This gives async resources
        // (STOMP connections, lazy-loaded chunks, etc.) time to
        // become available without forcing a full page reload.
        if (this.state.retryCount < MAX_AUTO_RETRIES) {
            this.autoRetryTimer = setTimeout(() => {
                this.setState((prev) => ({
                    hasError: false,
                    error: null,
                    retryCount: prev.retryCount + 1,
                }));
            }, AUTO_RETRY_DELAY_MS);
        }
    }

    componentDidUpdate(_: React.PropsWithChildren, previous: ErrorBoundaryState) {
        // Forgive past errors once the tree has rendered cleanly again.
        //
        // retryCount only ever increased, so three transient errors spread over
        // a long session permanently disabled auto-recovery — the fourth blip
        // stranded the user on the error screen.
        if (previous.hasError && !this.state.hasError && this.state.retryCount > 0) {
            this.recoveryTimer = setTimeout(() => {
                this.setState({ retryCount: 0 });
            }, STABLE_RENDER_MS);
        }
    }

    componentWillUnmount() {
        if (this.autoRetryTimer) {
            clearTimeout(this.autoRetryTimer);
        }
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
        }
    }

    /** Manual retry — clears the error and re-renders children in-place. */
    private handleRetry = () => {
        if (this.autoRetryTimer) {
            clearTimeout(this.autoRetryTimer);
        }
        this.setState({ hasError: false, error: null, retryCount: 0 });
    };

    /** Nuclear option — full browser reload. */
    private handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            const isAutoRetrying = this.state.retryCount < MAX_AUTO_RETRIES;

            return (
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    p: 4,
                    textAlign: 'center',
                }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Typography variant="h4" color="error" sx={{ mb: 2, fontWeight: 'bold' }}>
                            SYSTEM FAULT DETECTED
                        </Typography>
                        {isAutoRetrying ? (
                            <m.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                    {`Attempting automatic recovery... (${this.state.retryCount + 1}/${MAX_AUTO_RETRIES})`}
                                </Typography>
                            </m.div>
                        ) : (
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                An unexpected rendering error has occurred.
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 3, fontFamily: 'monospace' }}>
                            {this.state.error?.message}
                        </Typography>

                        {!isAutoRetrying && (
                            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', mt: 2 }}>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={this.handleRetry}
                                >
                                    RETRY
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={this.handleReload}
                                >
                                    RELOAD APPLICATION
                                </Button>
                            </Stack>
                        )}
                    </m.div>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
