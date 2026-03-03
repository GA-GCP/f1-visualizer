import React, { useEffect, useState } from 'react';
// Replace CircularProgress with Skeleton
import { Box, Typography, Container, Skeleton, Autocomplete, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../api/apiClient';
import LapTimeChart from '../components/LapTimeChart';
import type { LapDataRecord } from '../types/telemetry';
import { fetchDrivers, fetchSessions, type DriverProfile, type RaceSession } from '../api/referenceApi';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [driverColorMap, setDriverColorMap] = useState<Record<number, string>>({});

    // Dynamic Session state
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);

    // Fetch available sessions and driver colors on mount
    useEffect(() => {
        fetchSessions().then(data => {
            setSessions(data);
            if (data.length > 0) setSelectedSession(data[0]);
        });
        fetchDrivers().then((drivers: DriverProfile[]) => {
            const colorMap: Record<number, string> = {};
            for (const d of drivers) {
                colorMap[d.id] = d.teamColor;
            }
            setDriverColorMap(colorMap);
        });
    }, []);

    useEffect(() => {
        if (!selectedSession) return;

        let isMounted = true;

        const fetchLaps = async () => {
            setLoading(true); // Now safely awaited in a synchronous-looking flow
            try {
                const response = await apiClient.get<LapDataRecord[]>(
                    `/analysis/session/${selectedSession.sessionKey}/laps`
                );
                if (isMounted) {
                    setLaps(response.data);
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Failed to fetch historical data", err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void fetchLaps();
        return () => {
            isMounted = false;
        };
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
                        options={sessions}
                        getOptionLabel={(option) => `${option.year} ${option.meetingName}`}
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

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Skeleton
                            variant="rectangular"
                            height={400}
                            sx={{ bgcolor: '#1e1e1e', borderRadius: 2, mt: 2 }}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="chart"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <LapTimeChart
                            data={laps}
                            title={selectedSession ? `LAP TIMES // ${selectedSession.year} ${selectedSession.meetingName}` : undefined}
                            driverColorMap={driverColorMap}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};

export default HistoricalData;