import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import type { LocationPacket } from '../types/telemetry';

interface CircuitTraceProps {
    latestLocation: LocationPacket | null;
}

// We store history outside React state to avoid re-rendering the parent 60fps
const CircuitTrace: React.FC<CircuitTraceProps> = ({ latestLocation }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // "Ref" storage ensures these persist without triggering React renders
    const historyRef = useRef<{ x: number; y: number }[]>([]);
    const boundsRef = useRef({
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity
    });

    // 1. Data Ingestion Effect: Only runs when new data arrives
    useEffect(() => {
        if (!latestLocation) return;

        const { x, y } = latestLocation;

        // Add to history buffer
        historyRef.current.push({ x, y });

        // Update "Auto-Scale" bounds
        const b = boundsRef.current;
        b.minX = Math.min(b.minX, x);
        b.maxX = Math.max(b.maxX, x);
        b.minY = Math.min(b.minY, y);
        b.maxY = Math.max(b.maxY, y);

    }, [latestLocation]);

    // 2. Animation Loop Effect: Runs once on mount
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
            const history = historyRef.current;

            // Clear frame
            ctx.clearRect(0, 0, width, height);

            // Only draw if we have data
            if (history.length > 1) {
                // Add padding to the view
                const padding = 40;

                // Create D3 Scales dynamically based on current bounds
                // Note: We flip the Y range ([height, 0]) because Canvas Y starts at top
                const xScale = d3.scaleLinear()
                    .domain([b.minX, b.maxX])
                    .range([padding, width - padding]);

                const yScale = d3.scaleLinear()
                    .domain([b.minY, b.maxY])
                    .range([height - padding, padding]);

                // Draw the "Ghost Trace" (The Track)
                ctx.beginPath();
                ctx.strokeStyle = '#333'; // Dark Grey Trace
                ctx.lineWidth = 4;
                ctx.lineJoin = 'round';

                // Move to first point
                ctx.moveTo(xScale(history[0].x), yScale(history[0].y));

                // Connect the dots
                for (let i = 1; i < history.length; i++) {
                    const p = history[i];
                    ctx.lineTo(xScale(p.x), yScale(p.y));
                }
                ctx.stroke();

                // Draw the "Car" (Current Position)
                const lastPoint = history[history.length - 1];
                ctx.beginPath();
                ctx.fillStyle = '#e10600'; // F1 Red
                ctx.arc(xScale(lastPoint.x), yScale(lastPoint.y), 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#e10600';
            }

            // Request next frame
            animationFrameId = requestAnimationFrame(render);
        };

        // Start Loop
        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" color="primary" sx={{ mb: 1, alignSelf: 'flex-start' }}>
                CIRCUIT TRACE
            </Typography>
            <Box sx={{ border: '1px solid #333', borderRadius: 1, bgcolor: '#121212' }}>
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={400}
                    style={{ display: 'block' }}
                />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Live Plotting (Auto-Scale)
            </Typography>
        </Paper>
    );
};

export default CircuitTrace;