import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography } from '@mui/material';

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
    const [msgIdx, setMsgIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(
            () => setMsgIdx((p) => (p + 1) % STATUS_MESSAGES.length),
            2200,
        );
        return () => clearInterval(id);
    }, []);

    return (
        <motion.div
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
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
            }}
        >
            {/* Race info block */}
            <Typography
                sx={{
                    fontFamily: '"Titillium Web", sans-serif',
                    fontSize: '0.6rem',
                    letterSpacing: '0.3em',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    mb: 1,
                }}
            >
                YOU HAVE SELECTED
            </Typography>

            <Typography
                sx={{
                    fontFamily: '"Titillium Web", sans-serif',
                    fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#e10600',
                    textTransform: 'uppercase',
                }}
            >
                {year} {meetingName}
            </Typography>

            <Typography
                sx={{
                    fontFamily: '"Titillium Web", sans-serif',
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
            <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
                <Typography
                    sx={{
                        fontFamily: '"Titillium Web", sans-serif',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.3em',
                        color: 'rgba(255,255,255,0.6)',
                        mb: 2,
                    }}
                >
                    INITIALIZING
                </Typography>
            </motion.div>

            {/* Shimmer progress bar */}
            <Box sx={{ width: 240, mb: 2 }}>
                <Box
                    sx={{
                        height: 4,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        overflow: 'hidden',
                    }}
                >
                    <motion.div
                        style={{
                            height: '100%',
                            width: '100%',
                            background: 'linear-gradient(90deg, #e10600 0%, #ff3030 50%, #e10600 100%)',
                            backgroundSize: '200% 100%',
                            borderRadius: 2,
                        }}
                        animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    />
                </Box>
            </Box>

            {/* Cycling status messages */}
            <Box sx={{ height: 20, position: 'relative', width: 280 }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={msgIdx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        style={{ position: 'absolute', width: '100%' }}
                    >
                        <Typography
                            sx={{
                                fontSize: '0.55rem',
                                letterSpacing: '0.15em',
                                color: 'rgba(255,255,255,0.3)',
                                fontFamily: '"Titillium Web", sans-serif',
                                textAlign: 'center',
                            }}
                        >
                            {STATUS_MESSAGES[msgIdx]}
                        </Typography>
                    </motion.div>
                </AnimatePresence>
            </Box>
        </motion.div>
    );
};

export default CircuitTraceLoadingOverlay;
