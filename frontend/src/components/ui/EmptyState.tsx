import { Box, Typography } from '@mui/material';
import React from 'react';

interface EmptyStateProps {
    title: string;
    message?: string;
}

/** Shown when a request succeeded but there is genuinely nothing to display. */
const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => (
    <Box sx={{ textAlign: 'center', py: 8, px: 2, color: 'text.secondary' }}>
        <Typography variant="h6" component="p" sx={{ mb: 1 }}>
            {title}
        </Typography>
        {message && <Typography variant="body2">{message}</Typography>}
    </Box>
);

export default EmptyState;
