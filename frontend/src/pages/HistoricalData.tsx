import React, { useEffect, useState } from 'react';
import { Box, Typography, Container, CircularProgress } from '@mui/material';
import { apiClient } from '../api/apiClient';
import LapTimeChart from '../components/LapTimeChart';
import type { LapDataRecord } from '../types/telemetry';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use apiClient so the Okta JWT is attached and it hits the gateway correctly!
        apiClient.get<LapDataRecord[]>('/analysis/session/9165/laps')
            .then(response => {
                setLaps(response.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch historical data", err);
                setLoading(false);
            });
    }, []);

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white', mb: 1 }}>
                    💾 DATA VAULT
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    Historical Analysis // Session 9165
                </Typography>
            </Box>

            {loading ? (
                <CircularProgress color="primary" />
            ) : (
                <LapTimeChart data={laps} />
            )}
        </Container>
    );
};

export default HistoricalData;