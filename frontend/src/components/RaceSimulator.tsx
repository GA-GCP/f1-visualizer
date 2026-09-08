import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Chip,
    Snackbar,
    Alert,
    Button,
    CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import React, { useMemo, useState, useRef, useCallback } from 'react';
import { pauseSimulation } from '../api/ingestionApi';
import { rosterToDriverProfiles } from '../api/mappers';
import { queries } from '../api/queries';
import { retryStompConnection } from '../api/stompClient';
import { useUser } from '../context/UserContext';
import LiveTelemetryPanel from '../features/live/LiveTelemetryPanel';
import { useRaceSession } from '../features/live/useRaceSession';
import { useLocation } from '../hooks/useLocation';
import { createLogger } from '../lib/logger';
import { describeConnectionStatus } from '../realtime/connectionStatus';
import { useConnectionStatus } from '../realtime/useConnectionStatus';
import { CANVAS_BG, PAPER_BG } from '../theme/tokens';
import CircuitTrace from './CircuitTrace';
import MediaController from './MediaController';
import DriverSelector from './selectors/DriverSelector';
import SessionControlPanel from './selectors/SessionControlPanel';
import type { DriverProfile, RaceEntryRoster, RaceSession } from '../api/referenceApi';
import type { LocationPacket } from '../types/telemetry';

const log = createLogger('race-console');

const RaceSimulator: React.FC = () => {
    /** Only what the user actually picked; the default is derived below. */
    const [chosenDriver, setChosenDriver] = useState<DriverProfile | null>(null);
    // Location data bypasses React state entirely to avoid React 18 batching
    // that would drop intermediate GPS points.  The ref acts as a lock-free
    // queue that useLocation writes to and CircuitTrace drains each frame.
    const locationQueueRef = useRef<LocationPacket[]>([]);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [sessionDrivers, setSessionDrivers] = useState<DriverProfile[]>([]);
    // One state machine rather than four pieces of state kept in step by hand.
    const session = useRaceSession();

    const { userProfile } = useUser();
    // Depend on the primitive, not the profile object: UserProvider hands back a
    // new object on every render, so keying this effect on `userProfile` re-ran
    // the whole driver bootstrap — and reset the selection out from under the
    // user — whenever anything else in the profile changed identity.
    const favouriteDriverCode = userProfile?.preferences?.favoriteDriver;

    const driversQuery = useQuery(queries.drivers());
    const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);
    const isLoadingDrivers = driversQuery.isPending;

    // Use session-specific drivers when available, otherwise fall back to global drivers
    const displayDrivers = sessionDrivers.length > 0 ? sessionDrivers : drivers;

    // The default is derived, not seeded by an effect: storing it would mean a
    // synchronous setState inside an effect, and a cascading render every time
    // the roster or the favourite changed.
    const defaultDriver = useMemo(
        () =>
            displayDrivers.find((d) => d.code === favouriteDriverCode) ?? displayDrivers[0] ?? null,
        [displayDrivers, favouriteDriverCode],
    );
    const selectedDriver = chosenDriver ?? defaultDriver;

    const sessionKey = session.activeSession?.key;
    const lapsQuery = useQuery({
        ...queries.sessionLaps(sessionKey ?? 0),
        enabled: sessionKey !== undefined,
    });
    const sessionLaps = useMemo(() => lapsQuery.data ?? [], [lapsQuery.data]);

    const handleFirstPacket = session.firstFrame;

    useLocation(locationQueueRef);

    // One status for the whole feed, published by the STOMP client itself.
    const connectionStatus = useConnectionStatus();

    const handleStreamStarted = useCallback(
        (sessionKey: number, mode: 'LIVE' | 'SIMULATION', raceSession: RaceSession) => {
            locationQueueRef.current = [];
            session.start(sessionKey, mode, raceSession);
        },
        [session],
    );

    // Stable so memo() on MediaController actually holds.
    const handleSeek = useCallback(() => {
        locationQueueRef.current = [];
        session.seek();
    }, [session]);

    const handleCancelSimulation = useCallback(async () => {
        try {
            await pauseSimulation();
        } catch (err) {
            log.error('Failed to pause simulation on cancel', err);
        }
        locationQueueRef.current = [];
        session.cancel();
    }, [session]);

    const handleSessionSelected = useCallback((roster: RaceEntryRoster) => {
        // Only record the roster: the selection follows from it by derivation,
        // so a session change cannot strand a driver who is not in the new one.
        setSessionDrivers(rosterToDriverProfiles(roster));
        setChosenDriver(null);
    }, []);

    const dismissStreamError = useCallback(() => setStreamError(null), []);

    // Only complain once a session is running and the client has actually lost
    // the connection — 'idle' and 'connecting' are not failures.
    const feedInterrupted =
        session.isSessionActive &&
        (connectionStatus === 'reconnecting' ||
            connectionStatus === 'circuit-open' ||
            connectionStatus === 'offline' ||
            connectionStatus === 'auth-rejected');

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: CANVAS_BG, minHeight: '100vh', color: 'white' }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 4,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                }}
            >
                <Box>
                    {/* React 19 hoists this into <head>: every route shared one
                        static title before, so browser history and tab lists were
                        indistinguishable. */}
                    <title>Live Console · F1 Visualizer</title>
                    <Typography
                        variant="h4"
                        component="h1"
                        sx={{ fontWeight: 'bold', letterSpacing: 1 }}
                    >
                        <span aria-hidden="true">🏎️</span> RACE ENGINEER CONSOLE
                    </Typography>
                </Box>
                {/* One chip, and it says what is actually happening. Two chips
                    driven by independent pollers both showed a red "OFF" for the
                    first seconds of every load — before any attempt had had the
                    chance to fail — and neither could tell "connecting" from
                    "the breaker is open". `role="status"` so a change is
                    announced once, not once per chip. */}
                <Box role="status" aria-live="polite" sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                        label={`LIVE FEED: ${describeConnectionStatus(connectionStatus).toUpperCase()}`}
                        color={
                            connectionStatus === 'connected'
                                ? 'success'
                                : connectionStatus === 'connecting' ||
                                    connectionStatus === 'reconnecting'
                                  ? 'warning'
                                  : connectionStatus === 'idle'
                                    ? 'default'
                                    : 'error'
                        }
                        icon={
                            connectionStatus === 'connected' ? (
                                <CheckCircleIcon />
                            ) : (
                                <ErrorOutlineIcon />
                            )
                        }
                        variant="filled"
                    />
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Paper sx={{ bgcolor: PAPER_BG, border: '1px solid #333' }}>
                            <SessionControlPanel
                                onStreamStarted={handleStreamStarted}
                                onSessionSelected={handleSessionSelected}
                                onError={setStreamError}
                                isSessionActive={session.isSessionActive}
                                onCancel={() => void handleCancelSimulation()}
                            />
                        </Paper>

                        <AnimatePresence>
                            {session.activeSession?.mode === 'SIMULATION' && (
                                <m.div
                                    key="media-controller"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                >
                                    <MediaController onSeek={handleSeek} />
                                </m.div>
                            )}
                        </AnimatePresence>

                        <Paper sx={{ p: 2, bgcolor: PAPER_BG }}>
                            {isLoadingDrivers ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : (
                                <DriverSelector
                                    label="SELECT DRIVER CHANNEL"
                                    options={displayDrivers}
                                    value={selectedDriver}
                                    onChange={setChosenDriver}
                                />
                            )}
                        </Paper>

                        <LiveTelemetryPanel
                            selectedDriver={selectedDriver}
                            activeSession={session.activeSession}
                            sessionLaps={sessionLaps}
                            resetKey={session.resetKey}
                            onFirstPacket={handleFirstPacket}
                        />
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <CircuitTrace
                        locationQueueRef={locationQueueRef}
                        selectedDriver={selectedDriver}
                        sessionKey={session.activeSession?.key ?? null}
                        resetKey={session.resetKey}
                        isSessionActive={session.isSessionActive}
                        isInitializing={session.isInitializing}
                        sessionMeta={session.meta}
                        driverCode={selectedDriver?.code ?? null}
                    />
                </Grid>
            </Grid>

            {/* The message used to claim a reconnect was in progress regardless
                of whether the client was still trying. */}
            <Snackbar
                open={feedInterrupted}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={connectionStatus === 'reconnecting' ? 'warning' : 'error'}
                    variant="filled"
                    sx={{ width: '100%', fontWeight: 'bold', fontSize: '1.1rem' }}
                    action={
                        connectionStatus === 'circuit-open' || connectionStatus === 'offline' ? (
                            <Button color="inherit" size="small" onClick={retryStompConnection}>
                                RETRY
                            </Button>
                        ) : undefined
                    }
                >
                    {connectionStatus === 'reconnecting' &&
                        'LIVE FEED INTERRUPTED — RECONNECTING...'}
                    {connectionStatus === 'circuit-open' &&
                        'LIVE FEED UNAVAILABLE AFTER REPEATED FAILURES.'}
                    {connectionStatus === 'offline' &&
                        'YOU ARE OFFLINE. THE FEED WILL RESUME WHEN THE NETWORK RETURNS.'}
                    {connectionStatus === 'auth-rejected' &&
                        'SESSION EXPIRED. SIGN IN AGAIN TO RESUME THE FEED.'}
                </Alert>
            </Snackbar>

            <Snackbar
                open={!!streamError}
                autoHideDuration={8000}
                onClose={dismissStreamError}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity="error"
                    variant="filled"
                    onClose={dismissStreamError}
                    sx={{ width: '100%', fontWeight: 'bold' }}
                >
                    {streamError}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default RaceSimulator;
