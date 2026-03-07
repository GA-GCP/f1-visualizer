import React, { useEffect, useState } from 'react';
import { Box, Typography, Container, Autocomplete, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import LapTimeChart from '../components/LapTimeChart';
import DataVaultLoader from '../components/DataVaultLoader';
import type { LapDataRecord } from '../types/telemetry';
import { fetchSessions, fetchSessionDrivers, fetchSessionLaps, type RaceSession } from '../api/referenceApi';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [driverColorMap, setDriverColorMap] = useState<Record<number, string>>({});

    // Dynamic Session state
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);

    // Fetch available sessions on mount
    useEffect(() => {
        fetchSessions().then(data => {
            setSessions(data);
            if (data.length > 0) {
                setSelectedSession(data[0]);
            } else {
                setLoading(false);
            }
        }).catch(() => setLoading(false));
    }, []);

    // When session changes, fetch both laps and session-specific driver colors
    useEffect(() => {
        if (!selectedSession) return;

        let isMounted = true;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [lapsData, roster] = await Promise.all([
                    fetchSessionLaps(selectedSession.sessionKey),
                    fetchSessionDrivers(selectedSession.sessionKey),
                ]);
                if (isMounted) {
                    setLaps(lapsData);
                    // Build color map from session-specific driver roster
                    const colorMap: Record<number, string> = {};
                    for (const d of roster.drivers) {
                        colorMap[d.driverNumber] = '#' + (d.teamColour || 'ffffff');
                    }
                    setDriverColorMap(colorMap);
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

        void fetchData();
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
                        getOptionLabel={(option) => `${option.year} ${option.meetingName} - ${option.sessionName}`}
                        value={selectedSession}
                        onChange={(_, newValue) => setSelectedSession(newValue)}
                        isOptionEqualToValue={(option, value) => option.sessionKey === value.sessionKey}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.sessionKey}>
                                <Typography variant="body2">{option.year} {option.meetingName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.sessionName}]</Typography>
                            </Box>
                        )}
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
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <DataVaultLoader />
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