import React, { useState } from 'react';
import { Box, Button, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Autocomplete, TextField } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { MOCK_SESSIONS, type RaceSession } from '@/data/mockSessions.ts';

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted }) => {
    const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');
    const [selectedSession, setSelectedSession] = useState<RaceSession | null>(MOCK_SESSIONS[0]);
    const [isLoading, setIsLoading] = useState(false);

    const handleStart = async () => {
        if (!selectedSession) return;

        setIsLoading(true);
        try {
            await sendIngestionCommand({ mode, sessionKey: selectedSession.session_key });
            onStreamStarted(selectedSession.session_key, mode);
        } catch (error) {
            alert("Failed to connect to ingestion engine. Check console for details.");
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
                options={MOCK_SESSIONS}
                getOptionLabel={(option) => `${option.year} ${option.meeting_name} - ${option.session_name}`}
                value={selectedSession}
                onChange={(_, newValue) => setSelectedSession(newValue)}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.session_key}>
                        <Typography variant="body1">{option.year} {option.meeting_name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.session_name}]</Typography>
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select Grand Prix"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': { bgcolor: '#121212' }
                        }}
                    />
                )}
            />

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
        </Box>
    );
};

export default SessionControlPanel;