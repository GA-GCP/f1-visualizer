import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Container, Autocomplete, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import LapTimeChart from '../components/LapTimeChart';
import DataVaultLoader from '../components/DataVaultLoader';
import type { LapDataRecord } from '../types/telemetry';
import { fetchSessions, fetchSessionDrivers, fetchSessionLaps, type RaceSession } from '../api/referenceApi';
import { isRequestCancelled } from '../api/apiClient';
import { buildDriverColorMap, buildDriverLabelMap } from '../utils/chartScales';

const HistoricalData: React.FC = () => {
    const [laps, setLaps] = useState<LapDataRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [driverColorMap, setDriverColorMap] = useState<Record<number, string>>({});
    const [driverLabelMap, setDriverLabelMap] = useState<Record<number, string>>({});

    // Dynamic Session state.
    //
    // The selection lives in the URL rather than in component state: navigating
    // away unmounts the page, so a plain useState was lost on every visit to
    // another tab, and back/forward could not restore it either.
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const sessionKeyParam = searchParams.get('session');

    const selectedSession = useMemo(() => {
        if (sessions.length === 0) return null;
        const fromUrl = sessionKeyParam !== null
            ? sessions.find(s => String(s.sessionKey) === sessionKeyParam)
            : undefined;
        return fromUrl ?? sessions[0];
    }, [sessions, sessionKeyParam]);

    const setSelectedSession = useCallback((session: RaceSession | null) => {
        setSearchParams(
            previous => {
                const next = new URLSearchParams(previous);
                if (session) next.set('session', String(session.sessionKey));
                else next.delete('session');
                return next;
            },
            // Choosing a session is not a navigation: it should not add an entry
            // the back button has to walk through.
            { replace: true },
        );
    }, [setSearchParams]);

    // Fetch available sessions on mount
    useEffect(() => {
        const controller = new AbortController();
        fetchSessions(controller.signal)
            .then(data => {
                setSessions(data);
                if (data.length === 0) setLoading(false);
            })
            .catch(error => {
                if (!isRequestCancelled(error)) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    // When session changes, fetch both laps and session-specific driver colors
    useEffect(() => {
        if (!selectedSession) return;

        // Switching session mid-flight aborts the previous pair of requests
        // instead of leaving them running to be discarded on arrival.
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);
            try {
                const [lapsData, roster] = await Promise.all([
                    fetchSessionLaps(selectedSession.sessionKey, controller.signal),
                    fetchSessionDrivers(selectedSession.sessionKey, controller.signal),
                ]);
                setLaps(lapsData);
                setDriverColorMap(buildDriverColorMap(roster.drivers));
                setDriverLabelMap(buildDriverLabelMap(roster.drivers));
                setLoading(false);
            } catch (error) {
                if (isRequestCancelled(error)) return; // a newer session is loading
                console.error('Failed to fetch historical data', error);
                setLoading(false);
            }
        };

        void fetchData();
        return () => controller.abort();
    }, [selectedSession]);

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'white', mb: 1 }}>
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
                            driverLabelMap={driverLabelMap}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};

export default HistoricalData;