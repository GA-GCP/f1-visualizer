import { Box, CircularProgress } from '@mui/material';
import React from 'react';

/**
 * Shown while a lazily-loaded route chunk is in flight.
 *
 * In practice this is rarely seen: the authenticated chunks are prefetched
 * behind the splash, so it only appears when a chunk request is genuinely slow
 * or the user navigates before the prefetch has settled.
 */
const RouteFallback: React.FC = () => (
    <Box
        role="status"
        aria-label="Loading"
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
        }}
    >
        <CircularProgress color="primary" size={32} />
    </Box>
);

export default RouteFallback;
