import { Box, Paper, Typography } from '@mui/material';
import { AnimatePresence, m } from 'framer-motion';
import React, { memo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createLogger } from '../lib/logger';
import { CANVAS_BG, FONT_FAMILY, PAPER_BG } from '../theme/tokens';
import {
    areBoundsValid,
    computeBounds,
    createProjection,
    CIRCUIT_ASPECT_RATIO,
    type Bounds,
} from '../utils/circuitProjection';
import { drawCarDot, strokeTrace, type DriverHistory } from '../utils/circuitRenderer';
import CircuitTraceIdleOverlay from './CircuitTraceIdleOverlay';
import CircuitTraceLoadingOverlay from './CircuitTraceLoadingOverlay';
import type { DriverProfile } from '../api/referenceApi';
import type { LocationPacket } from '../types/telemetry';

const log = createLogger('trace');

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

const ASPECT_RATIO = CIRCUIT_ASPECT_RATIO;

/**
 * Points kept per driver — roughly one lap at the feed's sample rate.
 *
 * History used to grow by one heap-allocated point per packet per driver for a
 * whole replay, and every frame re-stroked all of it.
 */
const HISTORY_CAP = 1200;

/**
 * Trimming is done in blocks rather than one point at a time: a splice from the
 * front is O(n), and each trim also invalidates the cached layer, so doing it
 * per packet would force a full redraw every frame once the cap is reached.
 */
const HISTORY_TRIM_SLACK = 512;

/** Capped: past 2x the fill cost stops buying visible sharpness. */
const MAX_DPR = 2;

const emptyBounds = (): Bounds => ({
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
});

const CircuitTrace: React.FC<CircuitTraceProps> = ({
    locationQueueRef,
    selectedDriver,
    sessionKey,
    resetKey,
    isSessionActive,
    isInitializing,
    sessionMeta,
    driverCode,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // CSS-pixel canvas size. Kept in a ref, not state: the ResizeObserver sizes
    // the canvas imperatively, so a resize costs no React render (and cannot
    // reset the 2D context transform mid-frame).
    const sizeRef = useRef({ width: 800, height: 500 });

    // Map to store position history for ALL drivers
    const historyRef = useRef<DriverHistory>({});

    const boundsRef = useRef<Bounds>(emptyBounds());

    /**
     * Offscreen layer holding the polylines already drawn.
     *
     * Each frame blits this and then draws only the car dots, so a settled
     * camera costs one drawImage plus twenty arcs instead of re-stroking every
     * point of every driver. `key` identifies the projection and selection the
     * layer was drawn under; when it changes the layer is rebuilt from scratch.
     */
    const layerRef = useRef<{
        canvas: HTMLCanvasElement;
        ctx: CanvasRenderingContext2D;
        drawn: Record<number, number>;
        key: string;
    } | null>(null);

    /** Set whenever something that affects the picture changes. */
    const needsPaintRef = useRef(true);
    /** Bumped on every history trim, to invalidate the cached layer. */
    const trimGenerationRef = useRef(0);

    // Diagnostic counters (visible in the canvas overlay)
    const diagRef = useRef({
        totalPackets: 0,
        driversSeenSet: new Set<number>(),
        lastDrainSize: 0,
    });

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
        boundsRef.current = emptyBounds();
        diagRef.current = { totalPackets: 0, driversSeenSet: new Set(), lastDrainSize: 0 };
        needsPaintRef.current = true;
        if (import.meta.env.DEV && sessionKey !== null) {
            log.debug(
                `[CircuitTrace] Reset (session=${sessionKey}, resetKey=${resetKey}) — cleared all history and bounds`,
            );
        }
    }, [sessionKey, resetKey]);

    // Recompute the camera from what has already been recorded for the newly
    // selected driver.  Resetting to an empty box instead meant the projection
    // domain was a tiny, expanding rectangle for the next full lap, so the whole
    // circuit was drawn far outside the canvas and visibly 'zoomed out' as the
    // driver went round.  computeBounds does it in one pass over existing data.
    useEffect(() => {
        boundsRef.current = computeBounds(historyRef.current, selectedDriver?.id);
        needsPaintRef.current = true;
    }, [selectedDriver?.id]);

    // Size the backing store in device pixels and draw in CSS pixels.
    //
    // width/height used to equal the CSS width, so on a 2x display every canvas
    // pixel was stretched over four device pixels and the compositor resampled
    // the 1.5px ghost lines, the glow and the overlay text.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applySize = (cssWidth: number) => {
            const canvas = canvasRef.current;
            if (!canvas || cssWidth <= 0) return;

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            const width = Math.round(cssWidth);
            const height = Math.round(width / ASPECT_RATIO);

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            // Setting width/height resets the context, so the transform is
            // (re-)applied here rather than once at setup.
            canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

            sizeRef.current = { width, height };
            layerRef.current = null; // the cached layer is the wrong size now
            needsPaintRef.current = true;
        };

        applySize(container.getBoundingClientRect().width);

        const observer = new ResizeObserver((entries) => {
            applySize(entries[0].contentRect.width);
        });
        observer.observe(container);

        // Dragging the window to a display with a different pixel ratio does
        // not fire a resize, so watch the ratio itself.
        const dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        const onDprChange = () => applySize(container.getBoundingClientRect().width);
        dprQuery?.addEventListener?.('change', onDprChange);

        return () => {
            observer.disconnect();
            dprQuery?.removeEventListener?.('change', onDprChange);
        };
    }, []);

    // Single animation loop: drain the queue → ingest data → render canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Nothing to plot and nothing to clear away: do not hold a 60 fps loop
        // open behind the idle overlay.
        if (!isSessionActive) {
            const { width, height } = sizeRef.current;
            ctx.clearRect(0, 0, width, height);
            layerRef.current = null;
            needsPaintRef.current = true;
            return;
        }

        let animationFrameId: number;

        /** Cached-layer canvas, created lazily and resized with the main one. */
        const ensureLayer = (width: number, height: number, dpr: number) => {
            let layer = layerRef.current;
            if (layer?.canvas.width !== width * dpr || layer.canvas.height !== height * dpr) {
                const offscreen = document.createElement('canvas');
                offscreen.width = width * dpr;
                offscreen.height = height * dpr;
                const offscreenCtx = offscreen.getContext('2d');
                if (!offscreenCtx) return null;
                offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                layer = { canvas: offscreen, ctx: offscreenCtx, drawn: {}, key: '' };
                layerRef.current = layer;
            }
            return layer;
        };

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
                boundsRef.current = emptyBounds();
                diagRef.current = { totalPackets: 0, driversSeenSet: new Set(), lastDrainSize: 0 };
                locationQueueRef.current.length = 0;
                lastProcessedResetKeyRef.current = resetKeyRef.current;
                needsPaintRef.current = true;
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

                    let points = historyRef.current[driver_number];
                    if (!points) {
                        points = [];
                        historyRef.current[driver_number] = points;
                    }
                    points.push({ x, y });

                    // Ring-buffer the history, trimming in blocks.
                    if (points.length > HISTORY_CAP + HISTORY_TRIM_SLACK) {
                        points.splice(0, points.length - HISTORY_CAP);
                        trimGenerationRef.current++;
                    }

                    diagRef.current.totalPackets++;
                    diagRef.current.driversSeenSet.add(driver_number);

                    // Update auto-scale bounds only for the SELECTED driver
                    if (driver_number === driver?.id) {
                        const b = boundsRef.current;
                        b.minX = Math.min(b.minX, x);
                        b.maxX = Math.max(b.maxX, x);
                        b.minY = Math.min(b.minY, y);
                        b.maxY = Math.max(b.maxY, y);
                    }
                    needsPaintRef.current = true;
                }
                // Clear the queue in-place so the ref stays the same object
                queue.length = 0;

                // Log first drain and then periodically
                if (
                    import.meta.env.DEV &&
                    (diagRef.current.totalPackets <= drainSize ||
                        diagRef.current.totalPackets % 2000 < drainSize)
                ) {
                    const b = boundsRef.current;
                    log.debug(
                        `[CircuitTrace] Drained ${drainSize} packets | total=${diagRef.current.totalPackets} | ` +
                            `drivers=${diagRef.current.driversSeenSet.size} | ` +
                            `selected=${driver?.id ?? 'none'} | ` +
                            `boundsValid=${areBoundsValid(b)} (${areBoundsValid(b) ? `${b.minX.toFixed(0)}..${b.maxX.toFixed(0)}, ${b.minY.toFixed(0)}..${b.maxY.toFixed(0)}` : 'Infinity'})`,
                    );
                }
            }

            // ── 2. Render the canvas ──
            // Frames with nothing new used to clear and re-stroke the entire
            // history anyway, 60 times a second, over a page already running a
            // compositor-heavy layout.
            if (!needsPaintRef.current) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }
            needsPaintRef.current = false;

            const { width, height } = sizeRef.current;
            const b = boundsRef.current;
            const historyMap = historyRef.current;

            ctx.clearRect(0, 0, width, height);

            if (areBoundsValid(b)) {
                const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
                const projection = createProjection(b, width, height);
                const layer = ensureLayer(width, height, dpr);

                // Identity of everything the cached polylines depend on. The
                // bounds stop growing once the selected driver has completed a
                // lap, at which point the layer becomes purely incremental.
                const key =
                    `${width}x${height}|${b.minX},${b.maxX},${b.minY},${b.maxY}` +
                    `|${driver?.id ?? 'none'}|${driver?.teamColor ?? ''}|${trimGenerationRef.current}`;

                if (layer && layer.key !== key) {
                    layer.ctx.clearRect(0, 0, width, height);
                    layer.drawn = {};
                    layer.key = key;
                }

                for (const [key, points] of Object.entries(historyMap)) {
                    const driverId = Number(key);
                    const isSelected = driver?.id === driverId;

                    if (layer) {
                        layer.drawn[driverId] = strokeTrace(
                            layer.ctx,
                            points,
                            projection,
                            isSelected,
                            driver?.teamColor,
                            { from: layer.drawn[driverId] ?? 0 },
                        );
                    } else {
                        strokeTrace(ctx, points, projection, isSelected, driver?.teamColor);
                    }
                }

                if (layer) {
                    // drawImage takes device pixels; the context transform is
                    // in CSS pixels, so pass the CSS size.
                    ctx.drawImage(layer.canvas, 0, 0, width, height);
                }

                // Dots are drawn on the main canvas every frame: they move, and
                // their glow must not accumulate in the cached layer.
                for (const [key, points] of Object.entries(historyMap)) {
                    if (points.length === 0) continue;
                    drawCarDot(
                        ctx,
                        points[points.length - 1],
                        projection,
                        driver?.id === Number(key),
                        driver?.teamColor,
                    );
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [locationQueueRef, isSessionActive]);

    // Diagnostics, out of the canvas and off the render loop.  Painting them
    // into pixels put them beyond reach of assistive technology and forced a
    // text repaint every frame; at 1 Hz they are still perfectly readable.
    const [diagnostics, setDiagnostics] = useState('');
    useEffect(() => {
        if (!isSessionActive) return;
        const id = setInterval(() => {
            const diag = diagRef.current;
            setDiagnostics(
                `PKT: ${diag.totalPackets}  DRV: ${diag.driversSeenSet.size}  ` +
                    `BOUNDS: ${areBoundsValid(boundsRef.current) ? 'OK' : 'WAITING'}`,
            );
        }, 1000);
        return () => clearInterval(id);
    }, [isSessionActive]);

    return (
        <Paper
            sx={{
                p: 2,
                bgcolor: PAPER_BG,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 2,
                    mb: 1,
                    alignSelf: 'flex-start',
                }}
            >
                <Typography id="circuit-trace-title" variant="h6" component="h2" color="primary">
                    CIRCUIT TRACE
                </Typography>
                <AnimatePresence>
                    {isSessionActive && !isInitializing && sessionMeta && (
                        <m.div
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
                                    fontFamily: FONT_FAMILY,
                                    letterSpacing: '0.1em',
                                }}
                            >
                                {sessionMeta.year} | {sessionMeta.meetingName.toUpperCase()}
                            </Typography>
                        </m.div>
                    )}
                </AnimatePresence>
            </Box>
            <Box
                ref={containerRef}
                sx={{
                    position: 'relative',
                    border: '1px solid #333',
                    borderRadius: 1,
                    bgcolor: CANVAS_BG,
                    width: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* Sized imperatively by the ResizeObserver, in device pixels
                    with a CSS-pixel transform, so no resize costs a render.

                    The canvas had no role, no name and no text alternative, so
                    to assistive technology the main visualisation on the page
                    simply did not exist. */}
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-labelledby="circuit-trace-title"
                    aria-describedby="circuit-trace-caption"
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                >
                    Circuit trace{driverCode ? ` for ${driverCode}` : ''}: live car positions
                    plotted from GPS telemetry.
                </canvas>
                <AnimatePresence mode="wait">
                    {!isSessionActive && <CircuitTraceIdleOverlay key="idle" />}
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
            <Typography
                id="circuit-trace-caption"
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1 }}
            >
                Live Plotting (Tracking Driver: {selectedDriver?.code || 'None'})
            </Typography>
            {isSessionActive && diagnostics && (
                <Typography
                    component="p"
                    variant="caption"
                    aria-live="polite"
                    sx={{
                        alignSelf: 'flex-start',
                        mt: 0.5,
                        fontFamily: 'monospace',
                        color: 'text.disabled',
                    }}
                >
                    {diagnostics}
                </Typography>
            )}
        </Paper>
    );
};

// Memoised: RaceSimulator no longer re-renders per telemetry tick, but it does
// re-render on session, driver and connection changes, and this subtree is
// expensive — MUI Autocompletes re-run their renderInput/renderOption closures
// and Emotion re-serialises every sx object.
export default memo(CircuitTrace);
