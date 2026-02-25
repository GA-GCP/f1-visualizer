import React, { useState } from 'react';
import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { useTelemetry } from '../hooks/useTelemetry';
import { useLocation } from '../hooks/useLocation';
import CircuitTrace from './CircuitTrace';
import DriverSelector from './selectors/DriverSelector';
import { MOCK_DRIVERS, type DriverProfile } from '../data/mockDrivers';
import type { TelemetryPacket, LocationPacket } from '../types/telemetry';

const RaceSimulator: React.FC = () => {
    // State for Dynamic Inputs
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(MOCK_DRIVERS[0]);

    // Data State
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    const [lastLocation, setLastLocation] = useState<LocationPacket | null>(null);

    // 1. Hook into Physics Stream (Dynamic Filter)
    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        // Compare incoming driver_number with selected driver's ID
        if (selectedDriver && data.driver_number === selectedDriver.id) {
            setLastTelemetry(data);
        }
    });

    // 2. Hook into Spatial Stream (Dynamic Filter)
    const { isConnected: isLocationConnected } = useLocation((data) => {
        if (selectedDriver && data.driver_number === selectedDriver.id) {
            setLastLocation(data);
        }
    });

    return (
        <Box sx={{ p: 4, bgcolor: '#121212', minHeight: '100vh', color: 'white' }}>
            {/* Header Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                        🏎️ RACE ENGINEER CONSOLE
                    </Typography>
                    <Typography variant="subtitle2" color="primary">
                        LIVE DATA LINK: {selectedDriver ? selectedDriver.name.toUpperCase() : "NO DRIVER SELECTED"}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={isTelemetryConnected ? "TELEMETRY: ON" : "OFF"} color={isTelemetryConnected ? "success" : "error"} variant="filled" />
                    <Chip label={isLocationConnected ? "GPS: ON" : "OFF"} color={isLocationConnected ? "success" : "error"} variant="filled" />
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Driver Selector Row */}
                <Grid size={12}>
                    <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
                        <DriverSelector
                            label="SELECT DRIVER CHANNEL"
                            value={selectedDriver}
                            onChange={setSelectedDriver}
                        />
                    </Paper>
                </Grid>

                {/* Left Column: Physics Data */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '450px', borderTop: `4px solid ${selectedDriver?.teamColor || '#333'}` }}>
                        <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                            LIVE TELEMETRY
                        </Typography>
                        {lastTelemetry ? (
                            <Box>
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
                            </Box>
                        ) : (
                            <Typography color="text.secondary" sx={{ mt: 4, fontStyle: 'italic' }}>
                                Waiting for data from {selectedDriver?.name}...
                            </Typography>
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