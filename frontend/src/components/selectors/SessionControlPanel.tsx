import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { motion } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { fetchYears, fetchSessionsByYear, fetchSessionDrivers, type RaceSession, type RaceEntryRoster } from '@/api/referenceApi';

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION', session: RaceSession) => void;
    onSessionSelected?: (roster: RaceEntryRoster) => void;
    onError?: (message: string) => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted, onSessionSelected, onError }) => {
    const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');

    // Cascading state: Year → Sessions → Selected Session
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingYears, setIsLoadingYears] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    // Step 1: Load available years on mount
    useEffect(() => {
        let isMounted = true;
        setIsLoadingYears(true);
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
        setIsLoadingSessions(true);
        setSessions([]);
        setSelectedSession(null);

        fetchSessionsByYear(selectedYear)
            .then(data => {
                if (isMounted) {
                    setSessions(data);
                    if (data.length > 0) {
                        setSelectedSession(data[0]);
                    }
                }
            })
            .catch(err => console.error('Failed to load sessions for year', err))
            .finally(() => { if (isMounted) setIsLoadingSessions(false); });
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
            await sendIngestionCommand({ mode, sessionKey: selectedSession.sessionKey });
            onStreamStarted(selectedSession.sessionKey, mode, selectedSession);
        } catch (error) {
            console.error(error);
            const msg = mode === 'LIVE'
                ? 'LIVE STREAM FAILED: Could not connect to ingestion engine.'
                : 'SIMULATION FAILED: Could not start historical replay.';
            onError?.(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" color="text.secondary">
                RACE INITIALIZATION
            </Typography>

            <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, newMode) => newMode && setMode(newMode)}
                fullWidth
                sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}
            >
                <ToggleButton value="LIVE" color="error">
                    <SensorsIcon sx={{ mr: 1 }} /> LIVE FEED
                </ToggleButton>
                <ToggleButton value="SIMULATION" color="primary">
                    <HistoryIcon sx={{ mr: 1 }} /> HISTORICAL VAULT
                </ToggleButton>
            </ToggleButtonGroup>

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
                onChange={(_, newValue) => setSelectedSession(newValue)}
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

            <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}>
                <Button
                    variant="contained"
                    color={mode === 'LIVE' ? 'error' : 'primary'}
                    size="large"
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                    onClick={handleStart}
                    disabled={isLoading || !selectedSession}
                    sx={{ fontWeight: 'bold', py: 1.5 }}
                >
                    {isLoading ? 'INITIALIZING...' : `START ${mode} STREAM`}
                </Button>
            </motion.div>
        </Box>
    );
};

export default SessionControlPanel;
