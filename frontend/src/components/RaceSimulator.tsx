import React, { useState, useEffect } from 'react';
// 1. ADD Snackbar AND Alert TO THE MUI IMPORTS
import { Box, Typography, Paper, Grid, Chip, Snackbar, Alert } from '@mui/material';
import { useTelemetry } from '../hooks/useTelemetry';
import { useLocation } from '../hooks/useLocation';
import CircuitTrace from './CircuitTrace';
import DriverSelector from './selectors/DriverSelector';
import SessionControlPanel from './selectors/SessionControlPanel';
import MediaController from './MediaController';
import { fetchDrivers, type DriverProfile } from '../api/referenceApi';
import type { TelemetryPacket, LocationPacket } from '../types/telemetry';
import { useUser } from '../context/UserContext';

const RaceSimulator: React.FC = () => {
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
    const [activeSession, setActiveSession] = useState<{ key: number, mode: string } | null>(null);
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    const [lastLocation, setLastLocation] = useState<LocationPacket | null>(null);

    const { userProfile } = useUser();

    useEffect(() => {
        fetchDrivers().then(data => {
            setDrivers(data);
            if (data.length > 0) {
                const favCode = userProfile?.preferences?.favoriteDriver;
                const defaultDriver = data.find(d => d.code === favCode) || data[0];
                setSelectedDriver(defaultDriver);
            }
        });
    }, [userProfile]);

    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        if (selectedDriver && data.driver_number === selectedDriver.id) {
            setLastTelemetry(data);
        }
    });

    const { isConnected: isLocationConnected } = useLocation((data) => {
        setLastLocation(data);
    });

    const handleStreamStarted = (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => {
        setActiveSession({ key: sessionKey, mode });
        setLastTelemetry(null);
        setLastLocation(null);
    };

    // 2. NEW: Determine if we have dropped connection while a session is active
    const connectionLost = activeSession !== null && (!isTelemetryConnected || !isLocationConnected);

    return (
        <Box sx={{ p: 4, bgcolor: '#121212', minHeight: '100vh', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                        🏎️ RACE ENGINEER CONSOLE
                    </Typography>
                    <Typography variant="subtitle2" color="primary">
                        SESSION: {activeSession ? `${activeSession.key} [${activeSession.mode}]` : "AWAITING INITIALIZATION"}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={isTelemetryConnected ? "TELEMETRY: ON" : "OFF"} color={isTelemetryConnected ? "success" : "error"} variant="filled" />
                    <Chip label={isLocationConnected ? "GPS: ON" : "OFF"} color={isLocationConnected ? "success" : "error"} variant="filled" />
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                        <Paper sx={{ bgcolor: '#1e1e1e', border: '1px solid #333' }}>
                            <SessionControlPanel onStreamStarted={handleStreamStarted} />
                        </Paper>

                        {activeSession?.mode === 'SIMULATION' && (
                            <MediaController />
                        )}

                        <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
                            <DriverSelector
                                label="SELECT DRIVER CHANNEL"
                                options={drivers}
                                value={selectedDriver}
                                onChange={setSelectedDriver}
                            />
                        </Paper>

                        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '200px', borderTop: `4px solid ${selectedDriver?.teamColor || '#333'}` }}>
                            <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                                LIVE TELEMETRY
                            </Typography>
                            {lastTelemetry ? (
                                <Box>
                                    <Typography variant="h2" sx={{ fontWeight: 'bold', color: 'white' }}>
                                        {lastTelemetry.speed} <span style={{ fontSize: '1.5rem', color: '#666' }}>KM/H</span>
                                    </Typography>
                                    <Grid container spacing={2} sx={{ mt: 2 }}>
                                        <Grid size={4}>
                                            <Typography variant="caption" color="text.secondary">RPM</Typography>
                                            <Typography variant="h6">{lastTelemetry.rpm}</Typography>
                                        </Grid>
                                        <Grid size={4}>
                                            <Typography variant="caption" color="text.secondary">GEAR</Typography>
                                            <Typography variant="h6">{lastTelemetry.gear}</Typography>
                                        </Grid>
                                        <Grid size={4}>
                                            <Typography variant="caption" color="text.secondary">THROTTLE</Typography>
                                            <Typography variant="h6">{lastTelemetry.throttle}%</Typography>
                                        </Grid>
                                    </Grid>
                                </Box>
                            ) : (
                                <Typography color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                                    {activeSession ? `Waiting for data from ${selectedDriver?.code}...` : "Initialize a session to begin."}
                                </Typography>
                            )}
                        </Paper>

                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <CircuitTrace
                        latestLocation={lastLocation}
                        selectedDriver={selectedDriver}
                    />
                </Grid>
            </Grid>

            {/* 3. NEW: The Global Alert Banner */}
            <Snackbar open={connectionLost} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" variant="filled" sx={{ width: '100%', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    CRITICAL: LIVE FEED CONNECTION LOST. ATTEMPTING RECONNECT...
                </Alert>
            </Snackbar>

        </Box>
    );
};

export default RaceSimulator;