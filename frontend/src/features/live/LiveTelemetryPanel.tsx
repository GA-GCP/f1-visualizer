import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { m } from 'framer-motion';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { staggerContainer, staggerItem } from '../../theme/motion';
import { BORDER_SUBTLE, COMPOUND_COLOURS, COMPOUND_FALLBACK, FONT_FAMILY, PAPER_BG, type TyreCompound } from '../../theme/tokens';
import { buildLapIndex, findCurrentLap, type CurrentLap } from './lapCorrelation';
import type { DriverProfile } from '../../api/referenceApi';
import type { LapDataRecord, TelemetryPacket } from '../../types/telemetry';

/**
 * Minimum gap between committed readouts.
 *
 * The rAF drain still runs every frame — no packet is dropped from the trace —
 * but React only re-renders at 10 Hz, which is about as fast as a person can
 * read a number anyway. A gear change or the brake going on commits immediately,
 * because those are the transitions worth seeing without delay.
 */
const COMMIT_INTERVAL_MS = 100;

/** Fixed-width numeric cell, so digits changing never move the unit label. */
const numericSx = {
    fontVariantNumeric: 'tabular-nums',
} as const;

interface LiveTelemetryPanelProps {
    selectedDriver: DriverProfile | null;
    activeSession: { key: number; mode: string } | null;
    sessionLaps: LapDataRecord[];
    /** Bumped on session start, seek and cancel; clears the readout. */
    resetKey: number;
    /** Fires once per session when the selected driver's first packet lands. */
    onFirstPacket: () => void;
}

/**
 * Owns the per-tick telemetry state.
 *
 * This used to live on RaceSimulator, so every flushed frame reconciled the
 * whole dashboard — two Autocompletes, the Slider, both Snackbars, the canvas
 * wrapper and some thirty fresh `sx` objects for Emotion to re-serialise — to
 * update four numbers. Keeping the state here means RaceSimulator no longer
 * re-renders on a tick at all.
 */
const LiveTelemetryPanel: React.FC<LiveTelemetryPanelProps> = ({
    selectedDriver,
    activeSession,
    sessionLaps,
    resetKey,
    onFirstPacket,
}) => {
    const [lastTelemetry, setLastTelemetry] = useState<TelemetryPacket | null>(null);
    const [currentLap, setCurrentLap] = useState<CurrentLap | null>(null);

    // Built once per session rather than per packet.
    const lapIndex = useMemo(() => buildLapIndex(sessionLaps), [sessionLaps]);

    // Read inside the subscription callback, which must not resubscribe when
    // these change.
    const lapIndexRef = useRef(lapIndex);
    const driverIdRef = useRef(selectedDriver?.id);
    const sessionKeyRef = useRef(activeSession?.key);
    const onFirstPacketRef = useRef(onFirstPacket);
    const resetKeyRef = useRef(resetKey);
    const lastCommitRef = useRef(0);
    /** The resetKey whose first packet has already been announced. */
    const announcedForRef = useRef<number | null>(null);
    /** The packet most recently committed to state, for the rate gate. */
    const lastCommittedRef = useRef<TelemetryPacket | null>(null);

    useEffect(() => {
        lapIndexRef.current = lapIndex;
        driverIdRef.current = selectedDriver?.id;
        sessionKeyRef.current = activeSession?.key;
        onFirstPacketRef.current = onFirstPacket;
        resetKeyRef.current = resetKey;
    }, [lapIndex, selectedDriver?.id, activeSession?.key, onFirstPacket, resetKey]);

    // A new session, a seek or a cancel invalidates whatever is on screen.
    //
    // Done during render — React's documented way to adjust state when a prop
    // changes — rather than in an effect, which would commit a render showing
    // stale telemetry and then immediately re-render to clear it. The rate-gate
    // refs need no reset: lastCommitRef is old enough that the next packet
    // always passes the time check.
    const [seenResetKey, setSeenResetKey] = useState(resetKey);
    if (resetKey !== seenResetKey) {
        setSeenResetKey(resetKey);
        setLastTelemetry(null);
        setCurrentLap(null);
    }

    useTelemetry((packet) => {
        if (packet.driver_number !== driverIdRef.current) return;
        if (packet.session_key !== sessionKeyRef.current) return;

        if (announcedForRef.current !== resetKeyRef.current) {
            announcedForRef.current = resetKeyRef.current;
            onFirstPacketRef.current();
        }

        const previous = lastCommittedRef.current;
        const now = performance.now();
        const dueByTime = now - lastCommitRef.current >= COMMIT_INTERVAL_MS;
        const gearChanged = packet.gear !== previous?.gear;
        const brakeToggled = (packet.brake > 0) !== ((previous?.brake ?? 0) > 0);

        if (dueByTime || gearChanged || brakeToggled) {
            lastCommitRef.current = now;
            lastCommittedRef.current = packet;
            setLastTelemetry(packet);

            const matched = findCurrentLap(
                lapIndexRef.current,
                packet.driver_number,
                Date.parse(packet.date),
            );
            // Bail out of the render when the lap has not actually changed.
            setCurrentLap(prev =>
                prev?.lapNumber === matched?.lapNumber ? prev : matched,
            );
        }
    });


    return (
        <Paper sx={{
            p: 3,
            bgcolor: PAPER_BG,
            color: 'white',
            minHeight: '200px',
            borderTop: `4px solid ${selectedDriver?.teamColor || BORDER_SUBTLE}`,
        }}>
            <Typography variant="h6" component="h2" color="secondary" sx={{ mb: 2 }}>
                LIVE TELEMETRY
            </Typography>
            {lastTelemetry ? (
                <m.div variants={staggerContainer} initial="hidden" animate="visible">
                    {currentLap && (
                        <m.div variants={staggerItem}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <Typography variant="h6" component="p" sx={{
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    ...numericSx,
                                }}>
                                    LAP {currentLap.lapNumber}
                                    <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                                        /{currentLap.totalLaps}
                                    </span>
                                </Typography>
                                {currentLap.isFormationLap && (
                                    <Chip label="FORMATION LAP" size="small"
                                        sx={{ bgcolor: '#ff9800', color: 'black', fontWeight: 700, fontSize: '0.75rem' }} />
                                )}
                                {currentLap.isPitOutLap && (
                                    <Chip label="PIT OUT" size="small"
                                        sx={{ bgcolor: '#2196f3', color: 'white', fontWeight: 700, fontSize: '0.75rem' }} />
                                )}
                                {currentLap.compound && currentLap.prevCompound &&
                                 currentLap.compound !== currentLap.prevCompound && (
                                    <Chip
                                        label={`${currentLap.prevCompound} → ${currentLap.compound}`}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem' }}
                                    />
                                )}
                                {currentLap.compound && (
                                    <Chip label={currentLap.compound} size="small" variant="outlined"
                                        sx={{
                                            borderColor: COMPOUND_COLOURS[currentLap.compound as TyreCompound] ?? COMPOUND_FALLBACK,
                                            color: 'white',
                                            fontSize: '0.75rem',
                                        }}
                                    />
                                )}
                            </Box>
                        </m.div>
                    )}
                    <m.div variants={staggerItem}>
                        <Typography variant="h2" component="p" sx={{ fontWeight: 'bold', color: 'white' }}>
                            <Box component="span" sx={{
                                ...numericSx,
                                display: 'inline-block',
                                minWidth: '3ch',
                                textAlign: 'right',
                            }}>
                                {lastTelemetry.speed}
                            </Box>
                            {' '}
                            <span style={{ fontSize: '1.5rem', color: '#666' }}>KM/H</span>
                        </Typography>
                    </m.div>
                    <Grid container component="dl" spacing={2} sx={{ mt: 2, mb: 0 }}>
                        <Grid size={3}>
                            <m.div variants={staggerItem}>
                                <Typography variant="caption" component="dt" color="text.secondary">RPM</Typography>
                                <Typography variant="h6" component="dd" sx={{ m: 0, ...numericSx }}>{lastTelemetry.rpm}</Typography>
                            </m.div>
                        </Grid>
                        <Grid size={3}>
                            <m.div variants={staggerItem}>
                                <Typography variant="caption" component="dt" color="text.secondary">GEAR</Typography>
                                <Typography variant="h6" component="dd" sx={{ m: 0, ...numericSx }}>{lastTelemetry.gear}</Typography>
                            </m.div>
                        </Grid>
                        <Grid size={3}>
                            <m.div variants={staggerItem}>
                                <Typography variant="caption" component="dt" color="text.secondary">THROTTLE</Typography>
                                <Typography variant="h6" component="dd" sx={{ m: 0, ...numericSx }}>{lastTelemetry.throttle}%</Typography>
                            </m.div>
                        </Grid>
                        <Grid size={3}>
                            <m.div variants={staggerItem}>
                                <Typography variant="caption" component="dt" color="text.secondary">BRAKE</Typography>
                                <Typography variant="h6" component="dd" sx={{ m: 0, ...numericSx, color: lastTelemetry.brake > 0 ? '#ff4444' : 'white' }}>
                                    {lastTelemetry.brake}%
                                </Typography>
                            </m.div>
                        </Grid>
                    </Grid>
                </m.div>
            ) : (
                <Typography color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                    {activeSession ? `Waiting for data from ${selectedDriver?.code}...` : 'Initialize a session to begin.'}
                </Typography>
            )}
        </Paper>
    );
};

export default memo(LiveTelemetryPanel);
