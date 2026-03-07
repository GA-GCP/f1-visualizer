import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import type { LocationPacket } from '../types/telemetry';
import type { DriverProfile } from '../api/referenceApi';
import CircuitTraceIdleOverlay from './CircuitTraceIdleOverlay';
import CircuitTraceLoadingOverlay from './CircuitTraceLoadingOverlay';

interface CircuitTraceProps {
    /** Mutable queue of LocationPackets written by useLocation.  The animation
     *  loop drains it every frame so we never drop intermediate GPS points
     *  (React 18's automatic batching would swallow them via setState). */
    locationQueueRef: React.RefObject<LocationPacket[]>;
    selectedDriver: DriverProfile | null;
    /** When this value changes, all accumulated trace history is cleared. */
    sessionKey: number | null;
    /** Monotonic counter — incrementing this forces a full trace reset (used on
     *  seek and session restart to clear stale history). */
    resetKey: number;
    /** Whether a session is currently active (started by the user). */
    isSessionActive: boolean;
    /** Whether the session is initializing (waiting for first telemetry data). */
    isInitializing: boolean;
    /** Metadata about the active session (year and meeting name). */
    sessionMeta: { year: number; meetingName: string } | null;
    /** Driver code for the selected driver (e.g. "VER"). */
    driverCode: string | null;
}

const ASPECT_RATIO = 1.6; // width:height = 1.6:1

const CircuitTrace: React.FC<CircuitTraceProps> = ({ locationQueueRef, selectedDriver, sessionKey, resetKey, isSessionActive, isInitializing, sessionMeta, driverCode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });

    // Map to store position history for ALL drivers
    const historyRef = useRef<Record<number, { x: number; y: number }[]>>({});

    const boundsRef = useRef({
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity
    });

    // Diagnostic counters (visible in the canvas overlay)
    const diagRef = useRef({ totalPackets: 0, driversSeenSet: new Set<number>(), lastDrainSize: 0 });

    // Keep selectedDriver and sessionKey available to the animation loop via refs
    const selectedDriverRef = useRef(selectedDriver);
    useEffect(() => {
        selectedDriverRef.current = selectedDriver;
    }, [selectedDriver]);

    const sessionKeyRef = useRef(sessionKey);
    useEffect(() => {
        sessionKeyRef.current = sessionKey;
    }, [sessionKey]);

    // Mirror resetKey into a ref so the animation loop can detect changes.
    // useLayoutEffect fires synchronously after DOM commit — before the
    // next requestAnimationFrame — closing the race window where deferred
    // useEffect allowed stale STOMP packets to be drained into history.
    const resetKeyRef = useRef(resetKey);
    useLayoutEffect(() => {
        resetKeyRef.current = resetKey;
    }, [resetKey]);

    // Tracks the last resetKey the animation loop actually processed,
    // so it can detect when a new reset is pending.
    const lastProcessedResetKeyRef = useRef(resetKey);

    // ── Clear ALL accumulated state when the session or resetKey changes ──
    useEffect(() => {
        historyRef.current = {};
        boundsRef.current = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        diagRef.current = { totalPackets: 0, driversSeenSet: new Set(), lastDrainSize: 0 };
        if (sessionKey !== null) {
            console.log(`[CircuitTrace] Reset (session=${sessionKey}, resetKey=${resetKey}) — cleared all history and bounds`);
        }
    }, [sessionKey, resetKey]);

    // Reset the camera bounds when the selected driver changes
    useEffect(() => {
        boundsRef.current = {
            minX: Infinity, maxX: -Infinity,
            minY: Infinity, maxY: -Infinity
        };
    }, [selectedDriver?.id]);

    // Observe container resize for responsive canvas
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            if (width > 0) {
                setCanvasSize({ width: Math.round(width), height: Math.round(width / ASPECT_RATIO) });
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Single animation loop: drain the queue → ingest data → render canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const driver = selectedDriverRef.current;
            const activeSessionKey = sessionKeyRef.current;

            // ── 0. Synchronous reset check ──
            // React's useEffect for resetKey is deferred until after render,
            // leaving a gap where stale STOMP packets (old-position data still
            // in-flight after a seek) can be drained into history.  By checking
            // the ref here we clear history atomically BEFORE processing any
            // packets, closing the race window entirely.
            if (resetKeyRef.current !== lastProcessedResetKeyRef.current) {
                historyRef.current = {};
                boundsRef.current = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
                diagRef.current = { totalPackets: 0, driversSeenSet: new Set(), lastDrainSize: 0 };
                locationQueueRef.current.length = 0;
                lastProcessedResetKeyRef.current = resetKeyRef.current;
            }

            // ── 1. Drain the location queue (written by useLocation) ──
            const queue = locationQueueRef.current;
            if (queue.length > 0) {
                const drainSize = queue.length;
                diagRef.current.lastDrainSize = drainSize;

                for (const packet of queue) {
                    const { driver_number, x, y, session_key } = packet;

                    // Filter: only process packets belonging to the active session.
                    // Discard stale packets from a previous (or no) session.
                    if (activeSessionKey === null || session_key !== activeSessionKey) {
                        continue;
                    }

                    // Validate data before processing
                    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
                        continue;
                    }

                    if (!historyRef.current[driver_number]) {
                        historyRef.current[driver_number] = [];
                    }
                    historyRef.current[driver_number].push({ x, y });
                    diagRef.current.totalPackets++;
                    diagRef.current.driversSeenSet.add(driver_number);

                    // Update auto-scale bounds only for the SELECTED driver
                    if (driver && driver_number === driver.id) {
                        const b = boundsRef.current;
                        b.minX = Math.min(b.minX, x);
                        b.maxX = Math.max(b.maxX, x);
                        b.minY = Math.min(b.minY, y);
                        b.maxY = Math.max(b.maxY, y);
                    }
                }
                // Clear the queue in-place so the ref stays the same object
                queue.length = 0;

                // Log first drain and then periodically
                if (diagRef.current.totalPackets <= drainSize || diagRef.current.totalPackets % 2000 < drainSize) {
                    const b = boundsRef.current;
                    const boundsValid = b.minX !== Infinity;
                    console.log(
                        `[CircuitTrace] Drained ${drainSize} packets | total=${diagRef.current.totalPackets} | ` +
                        `drivers=${diagRef.current.driversSeenSet.size} | ` +
                        `selected=${driver?.id ?? 'none'} | ` +
                        `boundsValid=${boundsValid} (${boundsValid ? `${b.minX.toFixed(0)}..${b.maxX.toFixed(0)}, ${b.minY.toFixed(0)}..${b.maxY.toFixed(0)}` : 'Infinity'})`
                    );
                }
            }

            // ── 2. Render the canvas ──
            const width = canvas.width;
            const height = canvas.height;
            const b = boundsRef.current;
            const historyMap = historyRef.current;

            ctx.clearRect(0, 0, width, height);

            if (b.minX !== Infinity && b.maxX !== -Infinity) {
                const padding = 40;
                const minX = b.minX;
                let maxX = b.maxX;
                const minY = b.minY;
                let maxY = b.maxY;

                if (minX === maxX) maxX += 0.001;
                if (minY === maxY) maxY += 0.001;

                const xScale = d3.scaleLinear().domain([minX, maxX]).range([padding, width - padding]);
                const yScale = d3.scaleLinear().domain([minY, maxY]).range([height - padding, padding]);

                // Draw all driver traces
                Object.entries(historyMap).forEach(([driverIdStr, history]) => {
                    const driverId = parseInt(driverIdStr, 10);
                    if (history.length < 2) return;

                    const isSelected = driver?.id === driverId;

                    // Reset shadow state BEFORE drawing to prevent leaking
                    // from a previous iteration's glow settings.
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';

                    ctx.beginPath();
                    ctx.strokeStyle = isSelected ? (driver?.teamColor || '#e10600') : 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = isSelected ? 4 : 1.5;
                    ctx.lineJoin = 'round';

                    ctx.moveTo(xScale(history[0].x), yScale(history[0].y));
                    for (let i = 1; i < history.length; i++) {
                        ctx.lineTo(xScale(history[i].x), yScale(history[i].y));
                    }
                    ctx.stroke();

                    // Draw the "car" dot with glow for the selected driver
                    const lastPoint = history[history.length - 1];

                    if (isSelected) {
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = driver?.teamColor || '#e10600';
                    }

                    ctx.beginPath();
                    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)';
                    ctx.arc(xScale(lastPoint.x), yScale(lastPoint.y), isSelected ? 6 : 3, 0, 2 * Math.PI);
                    ctx.fill();

                    // Reset after drawing so the glow doesn't bleed
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                });
            }

            // ── 3. Draw diagnostic overlay (bottom-left) ──
            const diag = diagRef.current;
            ctx.save();
            ctx.font = '11px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.textBaseline = 'bottom';
            const boundsValid = b.minX !== Infinity;
            ctx.fillText(`PKT: ${diag.totalPackets}  DRV: ${diag.driversSeenSet.size}  BOUNDS: ${boundsValid ? 'OK' : 'WAITING'}`, 8, height - 6);
            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [locationQueueRef]);

    return (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1, alignSelf: 'flex-start' }}>
                <Typography variant="h6" color="primary">
                    CIRCUIT TRACE
                </Typography>
                <AnimatePresence>
                    {isSessionActive && !isInitializing && sessionMeta && (
                        <motion.div
                            key="race-info"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 0.4, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'rgba(255,255,255,0.4)',
                                    fontFamily: '"Titillium Web", sans-serif',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                {sessionMeta.year} | {sessionMeta.meetingName.toUpperCase()}
                            </Typography>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>
            <Box ref={containerRef} sx={{ position: 'relative', border: '1px solid #333', borderRadius: 1, bgcolor: '#121212', width: '100%', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                />
                <AnimatePresence mode="wait">
                    {!isSessionActive && (
                        <CircuitTraceIdleOverlay key="idle" />
                    )}
                    {isSessionActive && isInitializing && (
                        <CircuitTraceLoadingOverlay
                            key="loading"
                            year={sessionMeta!.year}
                            meetingName={sessionMeta!.meetingName}
                            driverCode={driverCode || 'N/A'}
                        />
                    )}
                </AnimatePresence>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Live Plotting (Tracking Driver: {selectedDriver?.code || 'None'})
            </Typography>
        </Paper>
    );
};

export default CircuitTrace;
