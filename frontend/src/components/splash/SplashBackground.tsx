import React from 'react';
import { motion } from 'framer-motion';
import { Box } from '@mui/material';

const GRID_SVG = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<line x1="0" y1="0" x2="40" y2="0" stroke="white" stroke-width="0.5"/>' +
    '<line x1="0" y1="0" x2="0" y2="40" stroke="white" stroke-width="0.5"/>' +
    '</svg>'
);

const SplashBackground: React.FC = () => (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Base */}
        <motion.div
            style={{
                position: 'absolute',
                inset: 0,
                background: '#101010',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        />

        {/* Diagonal gradient sweep */}
        <motion.div
            style={{
                position: 'absolute',
                inset: 0,
                background:
                    'linear-gradient(135deg, transparent 0%, transparent 40%, rgba(225,6,0,0.06) 50%, transparent 60%, transparent 100%)',
                backgroundSize: '200% 200%',
            }}
            animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
            transition={{
                duration: 2.5,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse',
            }}
        />

        {/* Telemetry grid */}
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,${GRID_SVG}")`,
                backgroundRepeat: 'repeat',
            }}
        />

        {/* Pulsing radial glow */}
        <motion.div
            style={{
                position: 'absolute',
                inset: 0,
                background:
                    'radial-gradient(circle at 50% 45%, rgba(225,6,0,0.05) 0%, transparent 60%)',
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
    </Box>
);

export default SplashBackground;
