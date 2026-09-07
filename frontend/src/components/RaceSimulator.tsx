import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Grid, Chip, Snackbar, Alert, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from '../hooks/useLocation';
import CircuitTrace from './CircuitTrace';
import DriverSelector from './selectors/DriverSelector';
import SessionControlPanel from './selectors/SessionControlPanel';
import MediaController from './MediaController';
import LiveTelemetryPanel from '../features/live/LiveTelemetryPanel';
import { fetchDrivers, fetchSessionLaps, type DriverProfile, type RaceEntryRoster, type RaceSession } from '../api/referenceApi';
import { pauseSimulation } from '../api/ingestionApi';
import type { LocationPacket, LapDataRecord } from '../types/telemetry';
import { useUser } from '../context/UserContext';
import { useCallback } from 'react';

const RaceSimulator: React.FC = () => {
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
    const [activeSession, setActiveSession] = useState<{ key: number, mode: string } | null>(null);
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

    const { userProfile } = useUser();
    // Depend on the primitive, not the profile object: UserProvider hands back a
    // new object on every render, so keying this effect on `userProfile` re-ran
    // the whole driver bootstrap — and reset the selection out from under the
    // user — whenever anything else in the profile changed identity.
    const favouriteDriverCode = userProfile?.preferences?.favoriteDriver;

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        const initializeDrivers = async () => {
            setIsLoadingDrivers(true);
            try {
                const data = await fetchDrivers(controller.signal);
                if (isMounted) {
                    setDrivers(data);
                    if (data.length > 0) {
                        const defaultDriver = data.find(d => d.code === favouriteDriverCode) || data[0];
                        // Only seed the default; never clobber a driver the user
                        // has already picked.
                        setSelectedDriver(prev => prev ?? defaultDriver);
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
            controller.abort();
        };
    }, [favouriteDriverCode]);

    useEffect(() => { isInitializingRef.current = isInitializing; }, [isInitializing]);
    useEffect(() => { sessionLapsRef.current = sessionLaps; }, [sessionLaps]);

    // Lifted out of LiveTelemetryPanel so the header chip and the lost-connection
    // banner can read it. Both change rarely, so they cost no per-tick renders.
    const [isTelemetryConnected, setIsTelemetryConnected] = useState(false);

    const handleFirstPacket = useCallback(() => {
        setIsInitializing(false);
    }, []);

    const { isConnected: isLocationConnected } = useLocation(locationQueueRef);

    const handleStreamStarted = useCallback((sessionKey: number, mode: 'LIVE' | 'SIMULATION', session: RaceSession) => {
        setSessionMeta({ year: session.year, meetingName: session.meetingName });
        setIsInitializing(true);
        setActiveSession({ key: sessionKey, mode });
        setSessionLaps([]);
        locationQueueRef.current = [];
        // Bumping this clears the trace and the telemetry panel together.
        setTraceResetKey(prev => prev + 1);

        // Pre-load lap data for lap tracking correlation
        fetchSessionLaps(sessionKey).then(laps => {
            setSessionLaps(laps);
        }).catch(err => console.error('Failed to pre-load lap data', err));
    }, []);

    // Stable so memo() on MediaController actually holds.
    const handleSeek = useCallback(() => {
        locationQueueRef.current = [];
        // Clears the trace and the telemetry panel, so neither shows data from
        // the wrong race position while the seek is in flight.
        setTraceResetKey(prev => prev + 1);
    }, []);

    const handleCancelSimulation = useCallback(async () => {
        try {
            await pauseSimulation();
        } catch (err) {
            console.error('Failed to pause simulation on cancel', err);
        }
        setActiveSession(null);
        setSessionLaps([]);
        setSessionMeta(null);
        setIsInitializing(false);
        locationQueueRef.current = [];
        setTraceResetKey(prev => prev + 1);
    }, []);

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

    const dismissStreamError = useCallback(() => setStreamError(null), []);

    const connectionLost = activeSession !== null && (!isTelemetryConnected || !isLocationConnected);

    return (
        <Box sx={{ p: 4, bgcolor: '#121212', minHeight: '100vh', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                        <span aria-hidden="true">🏎️</span> RACE ENGINEER CONSOLE
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
                            <SessionControlPanel onStreamStarted={handleStreamStarted} onSessionSelected={handleSessionSelected} onError={setStreamError} isSessionActive={activeSession !== null} onCancel={handleCancelSimulation} />
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

                        <LiveTelemetryPanel
                            selectedDriver={selectedDriver}
                            activeSession={activeSession}
                            sessionLaps={sessionLaps}
                            resetKey={traceResetKey}
                            onFirstPacket={handleFirstPacket}
                            onConnectionChange={setIsTelemetryConnected}
                        />

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

            <Snackbar open={connectionLost} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" variant="filled" sx={{ width: '100%', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    CRITICAL: LIVE FEED CONNECTION LOST. ATTEMPTING RECONNECT...
                </Alert>
            </Snackbar>

            <Snackbar open={!!streamError} autoHideDuration={8000} onClose={dismissStreamError} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" variant="filled" onClose={dismissStreamError} sx={{ width: '100%', fontWeight: 'bold' }}>
                    {streamError}
                </Alert>
            </Snackbar>

        </Box>
    );
};

export default RaceSimulator;