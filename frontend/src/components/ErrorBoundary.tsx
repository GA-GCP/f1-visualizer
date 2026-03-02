import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';

const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 2000;

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

    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = { hasError: false, error: null, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);

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

    componentWillUnmount() {
        if (this.autoRetryTimer) {
            clearTimeout(this.autoRetryTimer);
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
                    <Typography variant="h4" color="error" sx={{ mb: 2, fontWeight: 'bold' }}>
                        SYSTEM FAULT DETECTED
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                        {isAutoRetrying
                            ? `Attempting automatic recovery... (${this.state.retryCount + 1}/${MAX_AUTO_RETRIES})`
                            : 'An unexpected rendering error has occurred.'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 3, fontFamily: 'monospace' }}>
                        {this.state.error?.message}
                    </Typography>

                    {!isAutoRetrying && (
                        <Stack direction="row" spacing={2}>
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
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
