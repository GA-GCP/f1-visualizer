import React, { useState } from 'react';
import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { useTelemetry } from '../hooks/useTelemetry';
import { useLocation } from '../hooks/useLocation';
import CircuitTrace from './CircuitTrace';
import type { TelemetryPacket, LocationPacket } from '../types/telemetry';

const RaceSimulator: React.FC = () => {
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    const [lastLocation, setLastLocation] = useState<LocationPacket | null>(null);

    // Counters for debug stats
    const [telemetryCount, setTelemetryCount] = useState(0);
    const [locationCount, setLocationCount] = useState(0);

    // 🎯 DEFINE A TARGET DRIVER
    // In the future, this will be a dropdown selector
    const TARGET_DRIVER = 1;

    // 1. Hook into Physics Stream (Filter by Driver)
    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        setTelemetryCount(prev => prev + 1); // Count all traffic

        // ONLY update UI if it matches our driver
        if (data.driver_number === TARGET_DRIVER) {
            setLastTelemetry(data);
        }
    });

    // 2. Hook into Spatial Stream (Filter by Driver)
    const { isConnected: isLocationConnected } = useLocation((data) => {
        setLocationCount(prev => prev + 1); // Count all traffic

        // ONLY trace if it matches our driver
        if (data.driver_number === TARGET_DRIVER) {
            setLastLocation(data);
        }
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
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '450px' }}>
                        <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                            LIVE TELEMETRY
                        </Typography>
                        {lastTelemetry ? (
                            <Box>
                                {/* Visualizing Speed as a big number */}
                                <Typography variant="h1" sx={{ fontWeight: 'bold', color: 'white' }}>
                                    {lastTelemetry.speed} <span style={{fontSize: '1.5rem', color: '#666'}}>KM/H</span>
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

                                <Box sx={{ mt: 4, p: 2, bgcolor: '#000', borderRadius: 1, fontFamily: 'monospace' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>RAW PACKET</Typography>
                                    {JSON.stringify(lastTelemetry, null, 2)}
                                </Box>
                            </Box>
                        ) : (
                            <Typography color="text.secondary">Waiting for telemetry...</Typography>
                        )}
                    </Paper>
                </Grid>

                {/* Right Column: CIRCUIT TRACE */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <CircuitTrace latestLocation={lastLocation} />
                </Grid>
            </Grid>
        </Box>
    );
};

export default RaceSimulator;