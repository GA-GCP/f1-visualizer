import React, { useState } from 'react';
import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { useTelemetry } from '../hooks/useTelemetry';
import { useLocation } from '../hooks/useLocation';
import type { TelemetryPacket, LocationPacket } from '../types/telemetry';

const RaceSimulator: React.FC = () => {
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    const [lastLocation, setLastLocation] = useState<LocationPacket | null>(null);

    // Counters for debug stats
    const [telemetryCount, setTelemetryCount] = useState(0);
    const [locationCount, setLocationCount] = useState(0);

    // 1. Hook into Physics Stream
    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        setTelemetryCount(prev => prev + 1);
        setLastTelemetry(data);
    });

    // 2. Hook into Spatial Stream
    const { isConnected: isLocationConnected } = useLocation((data) => {
        setLocationCount(prev => prev + 1);
        setLastLocation(data);
    });

    return (
        <Box sx={{ p: 4, bgcolor: '#121212', minHeight: '100vh', color: 'white' }}>
            {/* Header Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                    🏎️ RACE ENGINEER CONSOLE
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                        label={isTelemetryConnected ? "TELEMETRY: ON" : "TELEMETRY: OFF"}
                        color={isTelemetryConnected ? "success" : "error"}
                        variant="filled"
                    />
                    <Chip
                        label={isLocationConnected ? "GPS: ON" : "GPS: OFF"}
                        color={isLocationConnected ? "success" : "error"}
                        variant="filled"
                    />
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Connection Stats */}
                <Grid size={12}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', borderLeft: '4px solid #e10600' }}>
                        <Typography variant="h6" color="primary" gutterBottom>DATA STREAM STATISTICS</Typography>
                        <Grid container spacing={4}>
                            <Grid size="auto">
                                <Typography variant="caption" color="text.secondary">TELEMETRY PACKETS</Typography>
                                <Typography variant="h4">{telemetryCount}</Typography>
                            </Grid>
                            <Grid size="auto">
                                <Typography variant="caption" color="text.secondary">GPS PACKETS</Typography>
                                <Typography variant="h4">{locationCount}</Typography>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* Left Column: Physics Data */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '300px' }}>
                        <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                            LIVE TELEMETRY
                        </Typography>
                        {lastTelemetry ? (
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                    {/* FIX: snake_case to match wire JSON */}
                                    Driver: #{lastTelemetry.driver_number}
                                </Typography>
                                <pre style={{ fontFamily: 'monospace', fontSize: '0.9rem', overflowX: 'auto' }}>
                                    {JSON.stringify(lastTelemetry, null, 2)}
                                </pre>
                            </Box>
                        ) : (
                            <Typography color="text.secondary">Waiting for car physics...</Typography>
                        )}
                    </Paper>
                </Grid>

                {/* Right Column: Spatial Data */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '300px' }}>
                        <Typography variant="h6" color="info.main" sx={{ mb: 2 }}>
                            LIVE GPS COORDINATES
                        </Typography>
                        {lastLocation ? (
                            <Box>
                                <Typography variant="h3" sx={{ fontFamily: 'monospace', mb: 1 }}>
                                    X: {lastLocation.x}
                                </Typography>
                                <Typography variant="h3" sx={{ fontFamily: 'monospace', mb: 1 }}>
                                    Y: {lastLocation.y}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                    {/* FIX: snake_case to match wire JSON */}
                                    Driver: #{lastLocation.driver_number}
                                </Typography>
                                <pre style={{ marginTop: '20px', fontSize: '0.8rem', opacity: 0.7 }}>
                                    {JSON.stringify(lastLocation, null, 2)}
                                </pre>
                            </Box>
                        ) : (
                            <Typography color="text.secondary">Waiting for GPS fix...</Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default RaceSimulator;