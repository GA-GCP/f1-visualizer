import React, { useEffect, useState } from 'react';
import { Box, Typography, Container, CircularProgress } from '@mui/material';
import axios from 'axios';
import LapTimeChart from '../components/LapTimeChart';
import type { LapDataRecord } from '../types/telemetry';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Hardcoded Session 9165 (Singapore 2023)
        // In the future, this comes from a dropdown
        axios.get<LapDataRecord[]>('/api/v1/analysis/session/9165/laps')
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