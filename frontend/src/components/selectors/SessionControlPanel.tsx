import React, { useState } from 'react';
import { Box, Button, TextField, Typography, ToggleButton, ToggleButtonGroup, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';

interface SessionControlPanelProps {
    onStreamStarted: (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => void;
}

const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ onStreamStarted }) => {
    const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');
    const [sessionKey, setSessionKey] = useState<string>('9165'); // Default to Singapore 2023 for testing
    const [isLoading, setIsLoading] = useState(false);

    const handleStart = async () => {
        const parsedKey = parseInt(sessionKey, 10);
        if (isNaN(parsedKey)) return;

        setIsLoading(true);
        try {
            await sendIngestionCommand({ mode, sessionKey: parsedKey });
            onStreamStarted(parsedKey, mode);
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

            <TextField
                label="Session Key"
                variant="outlined"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                helperText="e.g., 9165 (Singapore 2023)"
                sx={{
                    '& .MuiOutlinedInput-root': {
                        bgcolor: '#121212',
                    }
                }}
            />

            <Button
                variant="contained"
                color={mode === 'LIVE' ? 'error' : 'primary'}
                size="large"
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleStart}
                disabled={isLoading || !sessionKey}
                sx={{ fontWeight: 'bold', py: 1.5 }}
            >
                {isLoading ? 'INITIALIZING...' : `START ${mode} STREAM`}
            </Button>
        </Box>
    );
};

export default SessionControlPanel;