import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography } from '@mui/material';

const STATUS_MESSAGES: { max: number; label: string }[] = [
    { max: 0.25, label: 'INITIALIZING TELEMETRY...' },
    { max: 0.50, label: 'LOADING DATA FEEDS...' },
    { max: 0.75, label: 'CALIBRATING SENSORS...' },
    { max: 1.00, label: 'PIT LANE CLEAR' },
];

function getStatusMessage(progress: number): string {
    for (const { max, label } of STATUS_MESSAGES) {
        if (progress <= max) return label;
    }
    return STATUS_MESSAGES[STATUS_MESSAGES.length - 1].label;
}

interface SplashProgressProps {
    progress: number;
}

const SplashProgress: React.FC<SplashProgressProps> = ({ progress }) => {
    const statusMessage = useMemo(() => getStatusMessage(progress), [progress]);
    const widthPercent = `${Math.min(progress * 100, 100)}%`;

    return (
        <Box
            sx={{
                position: 'absolute',
                bottom: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 300,
            }}
        >
            {/* Header label */}
            <Typography
                variant="caption"
                sx={{
                    display: 'block',
                    textAlign: 'center',
                    mb: 1,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.3em',
                    fontSize: '0.6rem',
                    textTransform: 'uppercase',
                    fontFamily: '"Titillium Web", sans-serif',
                }}
            >
                SYSTEMS CHECK
            </Typography>

            {/* Progress bar track */}
            <Box
                sx={{
                    height: 4,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                {/* Fill with shimmer */}
                <motion.div
                    style={{
                        height: '100%',
                        width: widthPercent,
                        background:
                            'linear-gradient(90deg, #e10600 0%, #ff3030 50%, #e10600 100%)',
                        backgroundSize: '200% 100%',
                        borderRadius: 2,
                    }}
                    animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                />
            </Box>

            {/* Cycling status messages */}
            <Box sx={{ height: 20, mt: 1, position: 'relative' }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={statusMessage}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        style={{ position: 'absolute', width: '100%' }}
                    >
                        <Typography
                            variant="caption"
                            sx={{
                                display: 'block',
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: '0.55rem',
                                letterSpacing: '0.15em',
                                fontFamily: '"Titillium Web", sans-serif',
                            }}
                        >
                            {statusMessage}
                        </Typography>
                    </motion.div>
                </AnimatePresence>
            </Box>
        </Box>
    );
};

export default SplashProgress;
