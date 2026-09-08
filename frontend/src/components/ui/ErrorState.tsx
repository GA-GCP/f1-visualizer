import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import React from 'react';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

/**
 * Inline failure state for a page or panel.
 *
 * Pages previously had no error branch at all: an analysis-service failure left
 * the Versus page on an infinite skeleton and the Data Vault on a blank chart,
 * with the reason visible only in the console.
 */
const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'Something went wrong',
    message = 'The data could not be loaded.',
    onRetry,
}) => (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, px: 2 }}>
        <Alert
            severity="error"
            variant="outlined"
            sx={{ maxWidth: 560, width: '100%' }}
            action={onRetry ? (
                <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
                    Retry
                </Button>
            ) : undefined}
        >
            <AlertTitle>{title}</AlertTitle>
            {message}
        </Alert>
    </Box>
);

export default ErrorState;
