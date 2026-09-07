import React, { memo, useState, useEffect } from 'react';
import { Box, Button, Typography, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { fetchYears, fetchSessionsByYear, fetchSessionDrivers, type RaceSession, type RaceEntryRoster } from '@/api/referenceApi';

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION', session: RaceSession) => void;
    onSessionSelected?: (roster: RaceEntryRoster) => void;
    onError?: (message: string) => void;
    isSessionActive?: boolean;
    onCancel?: () => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted, onSessionSelected, onError, isSessionActive = false, onCancel }) => {
    // Cascading state: Year → Sessions → Selected Session
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    // Sessions and the current pick are both stored alongside the year they
    // belong to. A year change therefore empties the list, clears the selection
    // and re-enters the loading state by derivation — none of which the effect
    // has to write synchronously.
    const [sessionsForYear, setSessionsForYear] = useState<{ year: number; sessions: RaceSession[] } | null>(null);
    const [sessionChoice, setSessionChoice] = useState<{ year: number; session: RaceSession | null } | null>(null);

    const sessions = sessionsForYear?.year === selectedYear ? sessionsForYear.sessions : [];
    const selectedSession = sessionChoice?.year === selectedYear ? sessionChoice.session : null;
    const isLoadingSessions = selectedYear !== null && sessionsForYear?.year !== selectedYear;

    const [isLoading, setIsLoading] = useState(false);
    // The mount effect below always fetches, so years start out loading.
    const [isLoadingYears, setIsLoadingYears] = useState(true);

    // Step 1: Load available years on mount
    useEffect(() => {
        let isMounted = true;
        fetchYears()
            .then(data => {
                if (isMounted) {
                    setYears(data);
                    if (data.length > 0) {
                        setSelectedYear(data[0]); // Most recent year first
                    }
                }
            })
            .catch(err => console.error('Failed to load years', err))
            .finally(() => { if (isMounted) setIsLoadingYears(false); });
        return () => { isMounted = false; };
    }, []);

    // Step 2: When year changes, load sessions for that year
    useEffect(() => {
        if (selectedYear === null) return;

        let isMounted = true;
        fetchSessionsByYear(selectedYear)
            .then(data => {
                if (!isMounted) return;
                setSessionsForYear({ year: selectedYear, sessions: data });
                if (data.length > 0) {
                    setSessionChoice({ year: selectedYear, session: data[0] });
                }
            })
            .catch(err => {
                console.error('Failed to load sessions for year', err);
                // Recording an empty result clears the derived loading state.
                if (isMounted) setSessionsForYear({ year: selectedYear, sessions: [] });
            });
        return () => { isMounted = false; };
    }, [selectedYear]);

    // Step 3: When session changes, fetch driver roster and notify parent
    useEffect(() => {
        if (!selectedSession) return;

        let isMounted = true;
        fetchSessionDrivers(selectedSession.sessionKey)
            .then(roster => {
                if (isMounted) {
                    onSessionSelected?.(roster);
                }
            })
            .catch(err => console.error('Failed to load session drivers', err));
        return () => { isMounted = false; };
    }, [selectedSession, onSessionSelected]);

    const handleStart = async () => {
        if (!selectedSession) return;

        setIsLoading(true);
        try {
            await sendIngestionCommand({ mode: 'SIMULATION', sessionKey: selectedSession.sessionKey });
            onStreamStarted(selectedSession.sessionKey, 'SIMULATION', selectedSession);
        } catch (error) {
            console.error(error);
            onError?.('SIMULATION FAILED: Could not start historical replay.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" color="text.secondary">
                RACE INITIALIZATION
            </Typography>

            {/* Year Selector */}
            <Autocomplete
                options={years}
                loading={isLoadingYears}
                getOptionLabel={(option) => String(option)}
                value={selectedYear}
                onChange={(_, newValue) => setSelectedYear(newValue)}
                disableClearable={years.length > 0}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select Season..."
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#121212' } }}
                    />
                )}
            />

            {/* Grand Prix Selector (populated after year is selected) */}
            <Autocomplete
                options={sessions}
                loading={isLoadingSessions}
                getOptionLabel={(option) => `${option.meetingName} - ${option.sessionName}`}
                isOptionEqualToValue={(option, value) => option.sessionKey === value.sessionKey}
                value={selectedSession}
                onChange={(_, newValue) => { if (selectedYear !== null) setSessionChoice({ year: selectedYear, session: newValue }); }}
                disabled={sessions.length === 0}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.sessionKey}>
                        <Typography variant="body1">{option.meetingName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.sessionName}]</Typography>
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select Grand Prix..."
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#121212' } }}
                    />
                )}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <motion.div whileTap={!isSessionActive ? { scale: 0.97 } : {}} whileHover={!isSessionActive ? { scale: 1.02 } : {}}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        fullWidth
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                        onClick={handleStart}
                        disabled={isLoading || !selectedSession || isSessionActive}
                        sx={{ fontWeight: 'bold', py: 1.5 }}
                    >
                        {isLoading ? 'INITIALIZING...' : 'START SIMULATION'}
                    </Button>
                </motion.div>
                <AnimatePresence>
                    {isSessionActive && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Button
                                variant="outlined"
                                color="error"
                                size="large"
                                fullWidth
                                startIcon={<StopIcon />}
                                onClick={onCancel}
                                sx={{ fontWeight: 'bold', py: 1.5, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                            >
                                CANCEL SIMULATION
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>
        </Box>
    );
};

// Memoised: RaceSimulator no longer re-renders per telemetry tick, but it does
// re-render on session, driver and connection changes, and this subtree is
// expensive — MUI Autocompletes re-run their renderInput/renderOption closures
// and Emotion re-serialises every sx object.
export default memo(SessionControlPanel);
