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
import { fetchDrivers, fetchSessionLaps, type DriverProfile, type RaceEntryRoster, type RaceSession } from '../api/referenceApi';
import type { TelemetryPacket, LocationPacket, LapDataRecord } from '../types/telemetry';
import { useUser } from '../context/UserContext';
import { useCallback } from 'react';

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
    const [sessionDrivers, setSessionDrivers] = useState<DriverProfile[]>([]);
    const [sessionMeta, setSessionMeta] = useState<{ year: number; meetingName: string } | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const isInitializingRef = useRef(false);
    const [sessionLaps, setSessionLaps] = useState<LapDataRecord[]>([]);
    const sessionLapsRef = useRef<LapDataRecord[]>([]);
    const [currentLap, setCurrentLap] = useState<{
        lapNumber: number;
        totalLaps: number;
        isPitOutLap: boolean;
        compound: string | null;
        prevCompound: string | null;
        isFormationLap: boolean;
    } | null>(null);

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

    useEffect(() => { isInitializingRef.current = isInitializing; }, [isInitializing]);
    useEffect(() => { sessionLapsRef.current = sessionLaps; }, [sessionLaps]);

    const { isConnected: isTelemetryConnected } = useTelemetry((data) => {
        if (selectedDriver && data.driver_number === selectedDriver.id &&
            activeSession && data.session_key === activeSession.key) {
            setLastTelemetry(data);
            if (isInitializingRef.current) setIsInitializing(false);

            // Lap correlation: find which lap corresponds to this telemetry timestamp
            const driverLaps = sessionLapsRef.current
                .filter(l => l.driverNumber === data.driver_number && l.dateStart)
                .sort((a, b) => new Date(a.dateStart!).getTime() - new Date(b.dateStart!).getTime());

            if (driverLaps.length > 0) {
                const telemetryTime = new Date(data.date).getTime();
                let matched: LapDataRecord | null = null;

                for (let i = driverLaps.length - 1; i >= 0; i--) {
                    if (new Date(driverLaps[i].dateStart!).getTime() <= telemetryTime) {
                        matched = driverLaps[i];
                        break;
                    }
                }

                if (matched) {
                    const totalLaps = Math.max(...driverLaps.map(l => l.lapNumber));
                    const prevLap = driverLaps.find(l => l.lapNumber === matched!.lapNumber - 1);

                    setCurrentLap({
                        lapNumber: matched.lapNumber,
                        totalLaps,
                        isPitOutLap: matched.isPitOutLap ?? false,
                        compound: matched.compound ?? null,
                        prevCompound: prevLap?.compound ?? null,
                        isFormationLap: matched.lapNumber === 0,
                    });
                }
            }
        }
    });

    const { isConnected: isLocationConnected } = useLocation(locationQueueRef);

    const handleStreamStarted = (sessionKey: number, mode: 'LIVE' | 'SIMULATION', session: RaceSession) => {
        setSessionMeta({ year: session.year, meetingName: session.meetingName });
        setIsInitializing(true);
        setActiveSession({ key: sessionKey, mode });
        setLastTelemetry(null);
        setCurrentLap(null);
        setSessionLaps([]);
        locationQueueRef.current = [];
        setTraceResetKey(prev => prev + 1);

        // Pre-load lap data for lap tracking correlation
        fetchSessionLaps(sessionKey).then(laps => {
            setSessionLaps(laps);
        }).catch(err => console.error('Failed to pre-load lap data', err));
    };

    const handleSeek = () => {
        locationQueueRef.current = [];
        setTraceResetKey(prev => prev + 1);
        // Clear stale telemetry and lap state so the UI shows "waiting"
        // instead of data from the wrong race position after a seek.
        setLastTelemetry(null);
        setCurrentLap(null);
    };

    // Convert a session's driver roster into DriverProfile[] for the DriverSelector
    const handleSessionSelected = useCallback((roster: RaceEntryRoster) => {
        const profiles: DriverProfile[] = roster.drivers.map(entry => ({
            id: entry.driverNumber,
            code: entry.nameAcronym || (entry.broadcastName?.length >= 3 ? entry.broadcastName.substring(0, 3).toUpperCase() : String(entry.driverNumber)),
            name: entry.broadcastName || 'Unknown',
            team: entry.teamName || 'Unknown',
            teamColor: '#' + (entry.teamColour || 'ffffff'),
            stats: { speed: 80, consistency: 80, aggression: 80, tireMgmt: 80, experience: 80, wins: 0, podiums: 0, totalPoints: 0, bestChampionshipFinish: 0, totalRaces: 0, teamsDrivenFor: [] },
        }));

        setSessionDrivers(profiles);
        if (profiles.length > 0) {
            const favCode = userProfile?.preferences?.favoriteDriver;
            const defaultDriver = profiles.find(d => d.code === favCode) || profiles[0];
            setSelectedDriver(defaultDriver);
        }
    }, [userProfile]);

    // Use session-specific drivers when available, otherwise fall back to global drivers
    const displayDrivers = sessionDrivers.length > 0 ? sessionDrivers : drivers;

    // Determine if DRS is currently active for the selected driver
    const isDrsActive = lastTelemetry?.drs !== undefined && lastTelemetry.drs !== 0;

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
                            <SessionControlPanel onStreamStarted={handleStreamStarted} onSessionSelected={handleSessionSelected} onError={setStreamError} />
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
                                    options={displayDrivers}
                                    value={selectedDriver}
                                    onChange={setSelectedDriver}
                                />
                            )}
                        </Paper>

                        <motion.div
                            animate={{
                                boxShadow: isDrsActive
                                    ? ['0 0 0px rgba(0,255,136,0)', '0 0 20px rgba(0,255,136,0.3)', '0 0 0px rgba(0,255,136,0)']
                                    : '0 0 0px rgba(0,255,136,0)',
                            }}
                            transition={isDrsActive
                                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                                : { duration: 0.5 }
                            }
                            style={{ borderRadius: 4 }}
                        >
                            <Paper sx={{
                                p: 3,
                                bgcolor: '#1e1e1e',
                                color: 'white',
                                minHeight: '200px',
                                borderTop: `4px solid ${selectedDriver?.teamColor || '#333'}`,
                                border: isDrsActive ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent',
                                transition: 'border-color 0.5s ease',
                            }}>
                                <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                                    LIVE TELEMETRY
                                </Typography>
                                {lastTelemetry ? (
                                    <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                        {currentLap && (
                                            <motion.div variants={itemVariants}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                                    <Typography variant="h6" sx={{
                                                        fontFamily: '"Titillium Web", sans-serif',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.05em',
                                                    }}>
                                                        LAP {currentLap.lapNumber}
                                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                                                            /{currentLap.totalLaps}
                                                        </span>
                                                    </Typography>
                                                    {currentLap.isFormationLap && (
                                                        <Chip label="FORMATION LAP" size="small"
                                                            sx={{ bgcolor: '#ff9800', color: 'black', fontWeight: 700, fontSize: '0.65rem' }} />
                                                    )}
                                                    {currentLap.isPitOutLap && (
                                                        <Chip label="PIT OUT" size="small"
                                                            sx={{ bgcolor: '#2196f3', color: 'white', fontWeight: 700, fontSize: '0.65rem' }} />
                                                    )}
                                                    {currentLap.compound && currentLap.prevCompound &&
                                                     currentLap.compound !== currentLap.prevCompound && (
                                                        <Chip
                                                            label={`${currentLap.prevCompound} \u2192 ${currentLap.compound}`}
                                                            size="small"
                                                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.65rem' }}
                                                        />
                                                    )}
                                                    {currentLap.compound && (
                                                        <Chip label={currentLap.compound} size="small" variant="outlined"
                                                            sx={{
                                                                borderColor: currentLap.compound === 'SOFT' ? '#e10600'
                                                                    : currentLap.compound === 'MEDIUM' ? '#ffd700'
                                                                    : currentLap.compound === 'HARD' ? '#ffffff'
                                                                    : currentLap.compound === 'INTERMEDIATE' ? '#43b02a'
                                                                    : '#2196f3',
                                                                color: 'white',
                                                                fontSize: '0.65rem',
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </motion.div>
                                        )}
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
                                            <Grid size={4}>
                                                <motion.div variants={itemVariants}>
                                                    <Typography variant="caption" color="text.secondary">BRAKE</Typography>
                                                    <Typography variant="h6" sx={{ color: lastTelemetry.brake > 0 ? '#ff4444' : 'white' }}>
                                                        {lastTelemetry.brake}%
                                                    </Typography>
                                                </motion.div>
                                            </Grid>
                                            <Grid size={4}>
                                                <motion.div variants={itemVariants}>
                                                    <Typography variant="caption" color="text.secondary">DRS</Typography>
                                                    <Typography variant="h6" sx={{
                                                        color: lastTelemetry.drs !== 0 ? '#00ff88' : 'rgba(255,255,255,0.3)',
                                                        fontWeight: lastTelemetry.drs !== 0 ? 'bold' : 'normal',
                                                    }}>
                                                        {lastTelemetry.drs !== 0 ? 'ACTIVATED' : 'OFF'}
                                                    </Typography>
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
                        </motion.div>

                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <CircuitTrace
                        locationQueueRef={locationQueueRef}
                        selectedDriver={selectedDriver}
                        sessionKey={activeSession?.key ?? null}
                        resetKey={traceResetKey}
                        isSessionActive={activeSession !== null}
                        isInitializing={isInitializing}
                        sessionMeta={sessionMeta}
                        driverCode={selectedDriver?.code ?? null}
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