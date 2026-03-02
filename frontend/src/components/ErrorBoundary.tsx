import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
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
                        An unexpected rendering error has occurred.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 3, fontFamily: 'monospace' }}>
                        {this.state.error?.message}
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => window.location.reload()}
                    >
                        RELOAD APPLICATION
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
