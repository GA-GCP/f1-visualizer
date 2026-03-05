import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Autocomplete, TextField, createFilterOptions } from '@mui/material';
import { motion } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { fetchSessions, type RaceSession } from '@/api/referenceApi';

// Client-side filter that searches across year, meeting name, session name, and country
const sessionFilter = createFilterOptions<RaceSession>({
    stringify: (option) => `${option.year} ${option.meetingName} ${option.sessionName} ${option.countryName}`,
});

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => void;
    onError?: (message: string) => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted, onError }) => {
    const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    // Load all sessions once from Firestore cache (fast) — no server-side search needed
    useEffect(() => {
        let isMounted = true;
        setIsLoadingSessions(true);
        fetchSessions()
            .then(data => {
                if (isMounted) {
                    setSessions(data);
                    if (data.length > 0) {
                        setSelectedSession(data[0]);
                    }
                }
            })
            .catch(err => console.error('Failed to load sessions', err))
            .finally(() => { if (isMounted) setIsLoadingSessions(false); });
        return () => { isMounted = false; };
    }, []);

    const handleStart = async () => {
        if (!selectedSession) return;

        setIsLoading(true);
        try {
            await sendIngestionCommand({ mode, sessionKey: selectedSession.sessionKey });
            onStreamStarted(selectedSession.sessionKey, mode);
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

            <Autocomplete
                options={sessions}
                loading={isLoadingSessions}
                getOptionLabel={(option) => `${option.year} ${option.meetingName} - ${option.sessionName}`}
                isOptionEqualToValue={(option, value) => option.sessionKey === value.sessionKey}
                value={selectedSession}
                onChange={(_, newValue) => setSelectedSession(newValue)}
                filterOptions={sessionFilter}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.sessionKey}>
                        <Typography variant="body1">{option.year} {option.meetingName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.sessionName}]</Typography>
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Search Grand Prix..."
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
