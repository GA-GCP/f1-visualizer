import React, { useEffect, useState } from 'react';
import { Box, Typography, Container, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { apiClient } from '../api/apiClient';
import LapTimeChart from '../components/LapTimeChart';
import type { LapDataRecord } from '../types/telemetry';
import { MOCK_SESSIONS, type RaceSession } from '../data/mockSessions';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(MOCK_SESSIONS[0]);

    useEffect(() => {
        if (!selectedSession) return;

        setLoading(true);
        // Using the dynamic sessionKey
        apiClient.get<LapDataRecord[]>(`/analysis/session/${selectedSession.session_key}/laps`)
            .then(response => {
                setLaps(response.data);
            })
            .catch(err => {
                console.error("Failed to fetch historical data", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedSession]);

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white', mb: 1 }}>
                        💾 DATA VAULT
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Historical Analysis Engine
                    </Typography>
                </Box>

                {/* Dynamic Session Selector */}
                <Box sx={{ width: 300 }}>
                    <Autocomplete
                        options={MOCK_SESSIONS}
                        getOptionLabel={(option) => `${option.year} ${option.meeting_name}`}
                        value={selectedSession}
                        onChange={(_, newValue) => setSelectedSession(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Target Grand Prix"
                                variant="outlined"
                                size="small"
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a' } }}
                            />
                        )}
                    />
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                    <CircularProgress color="primary" />
                </Box>
            ) : (
                <LapTimeChart data={laps} />
            )}
        </Container>
    );
};

export default HistoricalData;