import React from 'react';
import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';

/**
 * Static overlay shown over the CircuitTrace canvas when no session is active.
 * Provides visual guidance prompting the user to select a race and start a simulation.
 * Uses the same animation patterns as DataVaultLoader and HeadToHeadLoader.
 */
const CircuitTraceIdleOverlay: React.FC = () => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            background: 'radial-gradient(ellipse at center, rgba(225,6,0,0.03) 0%, transparent 70%)',
        }}
    >
        {/* Pulsing SpeedIcon */}
        <motion.div
            animate={{ opacity: [0.15, 0.4, 0.15], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
            <SpeedIcon sx={{ fontSize: 64, color: '#e10600' }} />
        </motion.div>

        {/* Primary instructional text */}
        <Typography
            sx={{
                mt: 2,
                fontFamily: '"Titillium Web", sans-serif',
                fontSize: '0.75rem',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
                textTransform: 'uppercase',
            }}
        >
            SELECT A RACE AND START A SIMULATION
        </Typography>

        {/* Subtitle */}
        <Typography
            sx={{
                mt: 0.5,
                fontFamily: '"Titillium Web", sans-serif',
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.15)',
                textAlign: 'center',
            }}
        >
            CIRCUIT TRACE WILL APPEAR HERE
        </Typography>

        {/* Bottom shimmer bar */}
        <Box
            sx={{
                position: 'absolute',
                bottom: 16,
                left: '20%',
                right: '20%',
                height: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            <motion.div
                style={{
                    height: '100%',
                    width: '30%',
                    background: 'linear-gradient(90deg, transparent, rgba(225,6,0,0.2), transparent)',
                }}
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
        </Box>
    </motion.div>
);

export default CircuitTraceIdleOverlay;
