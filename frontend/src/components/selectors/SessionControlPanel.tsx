import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { motion } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { searchSessions, type RaceSession } from '@/api/referenceApi';

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => void;
    onError?: (message: string) => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted, onError }) => {
    const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');
    const [sessions, setSessions] = useState<RaceSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const hasAutoSelected = useRef(false);

    // Initial load & search trigger
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            searchSessions(inputValue).then(data => {
                setSessions(data);
                // Auto-select only on first load
                if (!hasAutoSelected.current && data.length > 0 && inputValue === '') {
                    hasAutoSelected.current = true;
                    setSelectedSession(prev => prev ? prev : data[0]);
                }
            });
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [inputValue]);

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
                getOptionLabel={(option) => `${option.year} ${option.meetingName} - ${option.sessionName}`}
                value={selectedSession}
                onChange={(_, newValue) => setSelectedSession(newValue)}
                inputValue={inputValue}
                onInputChange={(_, newInputValue) => setInputValue(newInputValue)} // <-- Handle typing
                filterOptions={(x) => x} // Disable built-in filtering, we do it server-side
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.sessionKey}>
                        <Typography variant="body1">{option.year} {option.meetingName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.sessionName}]</Typography>
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Search Grand Prix..." // <-- Updated Label
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