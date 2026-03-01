import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import type { LocationPacket } from '../types/telemetry';
import type { DriverProfile } from '../api/referenceApi';

interface CircuitTraceProps {
    latestLocation: LocationPacket | null;
    selectedDriver: DriverProfile | null;
}

const CircuitTrace: React.FC<CircuitTraceProps> = ({ latestLocation, selectedDriver }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // NEW: Map to store history for ALL drivers
    const historyRef = useRef<Record<number, { x: number; y: number }[]>>({});

    const boundsRef = useRef({
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity
    });

    // NEW: Reset the camera bounds when the selected driver changes
    useEffect(() => {
        boundsRef.current = {
            minX: Infinity, maxX: -Infinity,
            minY: Infinity, maxY: -Infinity
        };
    }, [selectedDriver?.id]);

    // 1. Data Ingestion Effect
    useEffect(() => {
        if (!latestLocation) return;

        const { driver_number, x, y } = latestLocation;

        if (!historyRef.current[driver_number]) {
            historyRef.current[driver_number] = [];
        }
        historyRef.current[driver_number].push({ x, y });

        // Only update "Auto-Scale" bounds based on the SELECTED driver's movement
        // This ensures the camera follows them specifically!
        if (selectedDriver && driver_number === selectedDriver.id) {
            const b = boundsRef.current;
            b.minX = Math.min(b.minX, x);
            b.maxX = Math.max(b.maxX, x);
            b.minY = Math.min(b.minY, y);
            b.maxY = Math.max(b.maxY, y);
        }

    }, [latestLocation, selectedDriver]);

    // 2. Animation Loop Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            const b = boundsRef.current;
            const historyMap = historyRef.current;

            ctx.clearRect(0, 0, width, height);

            // Ensure we have valid bounds to draw
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

                // Draw all lines
                Object.entries(historyMap).forEach(([driverIdStr, history]) => {
                    const driverId = parseInt(driverIdStr, 10);
                    if (history.length < 2) return;

                    const isSelected = selectedDriver?.id === driverId;

                    ctx.beginPath();
                    // NEW: Highlight selected driver in their team color, ghost others
                    ctx.strokeStyle = isSelected ? (selectedDriver?.teamColor || '#e10600') : 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = isSelected ? 4 : 1.5;
                    ctx.lineJoin = 'round';

                    ctx.moveTo(xScale(history[0].x), yScale(history[0].y));
                    for (let i = 1; i < history.length; i++) {
                        ctx.lineTo(xScale(history[i].x), yScale(history[i].y));
                    }
                    ctx.stroke();

                    // Draw the "Car" dot
                    const lastPoint = history[history.length - 1];
                    ctx.beginPath();
                    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)';
                    ctx.arc(xScale(lastPoint.x), yScale(lastPoint.y), isSelected ? 6 : 3, 0, 2 * Math.PI);
                    ctx.fill();

                    if (isSelected) {
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = selectedDriver?.teamColor || '#e10600';
                    } else {
                        ctx.shadowBlur = 0;
                    }
                });
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [selectedDriver]);

    return (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" color="primary" sx={{ mb: 1, alignSelf: 'flex-start' }}>
                CIRCUIT TRACE
            </Typography>
            <Box sx={{ border: '1px solid #333', borderRadius: 1, bgcolor: '#121212', width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                <canvas
                    ref={canvasRef}
                    width={800} // Increased width for a better aspect ratio
                    height={500}
                    style={{ display: 'block', maxWidth: '100%' }}
                />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Live Plotting (Tracking Driver: {selectedDriver?.code || 'None'})
            </Typography>
        </Paper>
    );
};

export default CircuitTrace;