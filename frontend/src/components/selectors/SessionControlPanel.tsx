import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { Box, Button, Typography, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { sendIngestionCommand } from '@/api/ingestionApi';
import { queries } from '@/api/queries';
import type { RaceSession, RaceEntryRoster } from '@/api/referenceApi';
import { createLogger } from '../../lib/logger';
import { CANVAS_BG } from '../../theme/tokens';

const log = createLogger('session-control');

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION', session: RaceSession) => void;
    onSessionSelected?: (roster: RaceEntryRoster) => void;
    onError?: (message: string) => void;
    isSessionActive?: boolean;
    onCancel?: () => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted, onSessionSelected, onError, isSessionActive = false, onCancel }) => {
    // Years, sessions and the roster are three cached queries rather than three
    // effects writing three pieces of mirrored state. The selections below store
    // only what the user actually chose; the defaults are derived, so changing
    // year cannot leave a stale session selected — the old key simply is not in
    // the new year's list and the first session applies.
    const yearsQuery = useQuery(queries.years());
    const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

    const [chosenYear, setChosenYear] = useState<number | null>(null);
    const selectedYear = chosenYear ?? years[0] ?? null;

    const sessionsQuery = useQuery({
        ...queries.sessionsByYear(selectedYear ?? 0),
        enabled: selectedYear !== null,
    });
    const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

    const [chosenSessionKey, setChosenSessionKey] = useState<number | null>(null);
    const selectedSession = sessions.find(s => s.sessionKey === chosenSessionKey) ?? sessions[0] ?? null;

    const rosterQuery = useQuery({
        ...queries.sessionDrivers(selectedSession?.sessionKey ?? 0),
        enabled: selectedSession !== null,
    });

    const roster = rosterQuery.data;
    useEffect(() => {
        if (roster) onSessionSelected?.(roster);
    }, [roster, onSessionSelected]);

    const [isLoading, setIsLoading] = useState(false);
    const isLoadingYears = yearsQuery.isPending;
    const isLoadingSessions = selectedYear !== null && sessionsQuery.isPending;

    const handleStart = async () => {
        if (!selectedSession) return;

        setIsLoading(true);
        try {
            await sendIngestionCommand({ mode: 'SIMULATION', sessionKey: selectedSession.sessionKey });
            onStreamStarted(selectedSession.sessionKey, 'SIMULATION', selectedSession);
        } catch (error) {
            log.error('Failed to start the simulation', error);
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
                onChange={(_, newValue) => setChosenYear(newValue)}
                disableClearable={years.length > 0}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select Season..."
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: CANVAS_BG } }}
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
                onChange={(_, newValue) => setChosenSessionKey(newValue?.sessionKey ?? null)}
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
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: CANVAS_BG } }}
                    />
                )}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <m.div whileTap={!isSessionActive ? { scale: 0.97 } : {}} whileHover={!isSessionActive ? { scale: 1.02 } : {}}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        fullWidth
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                        onClick={() => void handleStart()}
                        disabled={isLoading || !selectedSession || isSessionActive}
                        sx={{ fontWeight: 'bold', py: 1.5 }}
                    >
                        {isLoading ? 'INITIALIZING...' : 'START SIMULATION'}
                    </Button>
                </m.div>
                <AnimatePresence>
                    {isSessionActive && (
                        <m.div
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
                        </m.div>
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
