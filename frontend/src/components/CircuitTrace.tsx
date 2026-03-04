import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import type { LocationPacket } from '../types/telemetry';
import type { DriverProfile } from '../api/referenceApi';

interface CircuitTraceProps {
    /** Mutable queue of LocationPackets written by useLocation.  The animation
     *  loop drains it every frame so we never drop intermediate GPS points
     *  (React 18's automatic batching would swallow them via setState). */
    locationQueueRef: React.RefObject<LocationPacket[]>;
    selectedDriver: DriverProfile | null;
}

const ASPECT_RATIO = 1.6; // width:height = 1.6:1

const CircuitTrace: React.FC<CircuitTraceProps> = ({ locationQueueRef, selectedDriver }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });

    // Map to store position history for ALL drivers
    const historyRef = useRef<Record<number, { x: number; y: number }[]>>({});

    const boundsRef = useRef({
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity
    });

    // Keep selectedDriver available to the animation loop without re-creating it
    const selectedDriverRef = useRef(selectedDriver);
    useEffect(() => {
        selectedDriverRef.current = selectedDriver;
    }, [selectedDriver]);

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

            // ── 1. Drain the location queue (written by useLocation) ──
            const queue = locationQueueRef.current;
            if (queue.length > 0) {
                for (const packet of queue) {
                    const { driver_number, x, y } = packet;

                    if (!historyRef.current[driver_number]) {
                        historyRef.current[driver_number] = [];
                    }
                    historyRef.current[driver_number].push({ x, y });

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
                locationQueueRef.current.length = 0;
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

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [locationQueueRef]);

    return (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" color="primary" sx={{ mb: 1, alignSelf: 'flex-start' }}>
                CIRCUIT TRACE
            </Typography>
            <Box ref={containerRef} sx={{ border: '1px solid #333', borderRadius: 1, bgcolor: '#121212', width: '100%', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Live Plotting (Tracking Driver: {selectedDriver?.code || 'None'})
            </Typography>
        </Paper>
    );
};

export default CircuitTrace;
