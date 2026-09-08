import { Box, Typography } from '@mui/material';
import { m, useReducedMotion } from 'framer-motion';
import React from 'react';
import { BRAND_RED, FONT_FAMILY, SHIMMER_GRADIENT } from '../theme/tokens';
import CyclingStatusLabel from './ui/CyclingStatusLabel';

const STATUS_MESSAGES = [
    'CONNECTING TO DATA FEED...',
    'LOADING TELEMETRY CHANNELS...',
    'MAPPING GPS COORDINATES...',
    'CALIBRATING CIRCUIT BOUNDARIES...',
    'INITIALIZING REPLAY ENGINE...',
];

interface CircuitTraceLoadingOverlayProps {
    year: number;
    meetingName: string;
    driverCode: string;
}

/**
 * Loading overlay shown over the CircuitTrace canvas after a race simulation
 * is started but before telemetry data arrives. Displays the selected race info
 * and cycling status messages with a shimmer progress bar.
 *
 * Pattern follows SplashProgress and HeadToHeadLoader cycling message approach.
 */
const CircuitTraceLoadingOverlay: React.FC<CircuitTraceLoadingOverlayProps> = ({ year, meetingName, driverCode }) => {
    const reduceMotion = useReducedMotion();
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                // Opaque rather than blurred: this overlay sits directly on
                // top of a 60 fps canvas, so a backdrop-filter made the browser
                // re-snapshot and re-blur that canvas every frame.
                background: 'rgba(0,0,0,0.85)',
            }}
        >
            {/* Race info block */}
            <Typography
                sx={{
                    fontFamily: FONT_FAMILY,
                    fontSize: '0.75rem',
                    letterSpacing: '0.3em',
                    color: 'rgba(255,255,255,0.6)',
                    textTransform: 'uppercase',
                    mb: 1,
                }}
            >
                YOU HAVE SELECTED
            </Typography>

            <Typography
                sx={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: BRAND_RED,
                    textTransform: 'uppercase',
                }}
            >
                {year} {meetingName}
            </Typography>

            <Typography
                sx={{
                    fontFamily: FONT_FAMILY,
                    fontSize: '0.75rem',
                    letterSpacing: '0.2em',
                    color: 'rgba(255,255,255,0.5)',
                    mt: 0.5,
                    mb: 3,
                }}
            >
                DRIVER: {driverCode}
            </Typography>

            {/* INITIALIZING text with pulse */}
            <m.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
                <Typography
                    sx={{
                        fontFamily: FONT_FAMILY,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.3em',
                        color: 'rgba(255,255,255,0.6)',
                        mb: 2,
                    }}
                >
                    INITIALIZING
                </Typography>
            </m.div>

            {/* Shimmer progress bar */}
            <Box sx={{ width: 240, mb: 2 }}>
                <Box
                    sx={{
                        height: 4,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    {/* Shimmer driven by a transform on an oversized child.
                        `backgroundPosition` is not compositor-accelerated, so
                        framer wrote the inline style from JS every frame. The
                        gradient repeats once across the 200% width, so
                        translating by -50% loops seamlessly. */}
                    <m.div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: '200%',
                            background:
                                SHIMMER_GRADIENT,
                        }}
                        animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    />
                </Box>
            </Box>

            {/* Cycling status messages */}
            <Box sx={{ height: 20, position: 'relative', width: 280 }}>
                <CyclingStatusLabel messages={STATUS_MESSAGES} />
            </Box>
        </m.div>
    );
};

export default CircuitTraceLoadingOverlay;
