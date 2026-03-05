import React, { useState, useEffect, useRef } from 'react';
// 1. ADD Snackbar AND Alert TO THE MUI IMPORTS
import { Box, Typography, Paper, Grid, Chip, Snackbar, Alert, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelemetry } from '../hooks/useTelemetry';
import { useLocation } from '../hooks/useLocation';
import CircuitTrace from './CircuitTrace';
import DriverSelector from './selectors/DriverSelector';
import SessionControlPanel from './selectors/SessionControlPanel';
import MediaController from './MediaController';
import { fetchDrivers, type DriverProfile } from '../api/referenceApi';
import type { TelemetryPacket, LocationPacket } from '../types/telemetry';
import { useUser } from '../context/UserContext';

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const RaceSimulator: React.FC = () => {
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
    const [activeSession, setActiveSession] = useState<{ key: number, mode: string } | null>(null);
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    // Location data bypasses React state entirely to avoid React 18 batching
    // that would drop intermediate GPS points.  The ref acts as a lock-free
    // queue that useLocation writes to and CircuitTrace drains each frame.
    const locationQueueRef = useRef<LocationPacket[]>([]);
    const [traceResetKey, setTraceResetKey] = useState(0);
    const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    const { userProfile } = useUser();

    useEffect(() => {
        let isMounted = true;

        const initializeDrivers = async () => {
            setIsLoadingDrivers(true);
            try {
                const data = await fetchDrivers();
                if (isMounted) {
                    setDrivers(data);
                    if (data.length > 0) {
                        const favCode = userProfile?.preferences?.favoriteDriver;
                        const defaultDriver = data.find(d => d.code === favCode) || data[0];
                        setSelectedDriver(defaultDriver);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch drivers for simulator", err);
            } finally {
                if (isMounted) {
                    setIsLoadingDrivers(false);
                }
            }
        };

        void initializeDrivers();

        return () => {
            isMounted = false; // Cleanup to prevent state updates on unmounted components
        };
    }, [userProfile]);

    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        if (selectedDriver && data.driver_number === selectedDriver.id &&
            activeSession && data.session_key === activeSession.key) {
            setLastTelemetry(data);
        }
    });

    const { isConnected: isLocationConnected } = useLocation(locationQueueRef);

    const handleStreamStarted = (sessionKey: number, mode: 'LIVE' | 'SIMULATION') => {
        setActiveSession({ key: sessionKey, mode });
        setLastTelemetry(null);
        locationQueueRef.current = [];
        setTraceResetKey(prev => prev + 1);
    };

    const handleSeek = () => {
        locationQueueRef.current = [];
        setTraceResetKey(prev => prev + 1);
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
                            <SessionControlPanel onStreamStarted={handleStreamStarted} onError={setStreamError} />
                        </Paper>

                        <AnimatePresence>
                            {activeSession?.mode === 'SIMULATION' && (
                                <motion.div
                                    key="media-controller"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                >
                                    <MediaController onSeek={handleSeek} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
                            {isLoadingDrivers ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : (
                                <DriverSelector
                                    label="SELECT DRIVER CHANNEL"
                                    options={drivers}
                                    value={selectedDriver}
                                    onChange={setSelectedDriver}
                                />
                            )}
                        </Paper>

                        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white', minHeight: '200px', borderTop: `4px solid ${selectedDriver?.teamColor || '#333'}` }}>
                            <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                                LIVE TELEMETRY
                            </Typography>
                            {lastTelemetry ? (
                                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                    <motion.div variants={itemVariants}>
                                        <Typography variant="h2" sx={{ fontWeight: 'bold', color: 'white' }}>
                                            {lastTelemetry.speed} <span style={{ fontSize: '1.5rem', color: '#666' }}>KM/H</span>
                                        </Typography>
                                    </motion.div>
                                    <Grid container spacing={2} sx={{ mt: 2 }}>
                                        <Grid size={4}>
                                            <motion.div variants={itemVariants}>
                                                <Typography variant="caption" color="text.secondary">RPM</Typography>
                                                <Typography variant="h6">{lastTelemetry.rpm}</Typography>
                                            </motion.div>
                                        </Grid>
                                        <Grid size={4}>
                                            <motion.div variants={itemVariants}>
                                                <Typography variant="caption" color="text.secondary">GEAR</Typography>
                                                <Typography variant="h6">{lastTelemetry.gear}</Typography>
                                            </motion.div>
                                        </Grid>
                                        <Grid size={4}>
                                            <motion.div variants={itemVariants}>
                                                <Typography variant="caption" color="text.secondary">THROTTLE</Typography>
                                                <Typography variant="h6">{lastTelemetry.throttle}%</Typography>
                                            </motion.div>
                                        </Grid>
                                    </Grid>
                                </motion.div>
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
                        locationQueueRef={locationQueueRef}
                        selectedDriver={selectedDriver}
                        sessionKey={activeSession?.key ?? null}
                        resetKey={traceResetKey}
                    />
                </Grid>
            </Grid>

            {/* 3. NEW: The Global Alert Banner */}
            <Snackbar open={connectionLost} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" variant="filled" sx={{ width: '100%', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    CRITICAL: LIVE FEED CONNECTION LOST. ATTEMPTING RECONNECT...
                </Alert>
            </Snackbar>

            <Snackbar open={!!streamError} autoHideDuration={8000} onClose={() => setStreamError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" variant="filled" onClose={() => setStreamError(null)} sx={{ width: '100%', fontWeight: 'bold' }}>
                    {streamError}
                </Alert>
            </Snackbar>

        </Box>
    );
};

export default RaceSimulator;