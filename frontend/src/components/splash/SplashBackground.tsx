import React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Box } from '@mui/material';

const GRID_SVG = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<line x1="0" y1="0" x2="40" y2="0" stroke="white" stroke-width="0.5"/>' +
    '<line x1="0" y1="0" x2="0" y2="40" stroke="white" stroke-width="0.5"/>' +
    '</svg>'
);

// The sweep gradient is drawn at twice the viewport in both axes and repeated
// once per axis, so translating it by exactly -50% loops seamlessly.
const SWEEP_GRADIENT =
    'linear-gradient(135deg, ' +
    'transparent 0%, transparent 20%, rgba(225,6,0,0.06) 25%, transparent 30%, ' +
    'transparent 70%, rgba(225,6,0,0.06) 75%, transparent 80%, transparent 100%)';

const SplashBackground: React.FC = () => {
    const reduceMotion = useReducedMotion();

    return (
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {/* Base */}
            <m.div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#101010',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            />

            {/* Diagonal gradient sweep.

                Driven by `x`/`y` on an oversized child rather than by
                `backgroundPosition`, which is not compositor-accelerated: framer
                had to write the inline style from JS every frame, re-rasterising
                a viewport-sized gradient at 60 fps for as long as the page was
                open — on the Landing page, indefinitely. */}
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <m.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '200%',
                        height: '200%',
                        background: SWEEP_GRADIENT,
                        willChange: reduceMotion ? undefined : 'transform',
                    }}
                    animate={reduceMotion ? undefined : { x: ['0%', '-50%'], y: ['0%', '-50%'] }}
                    transition={{
                        duration: 2.5,
                        ease: 'easeInOut',
                        repeat: Infinity,
                        repeatType: 'reverse',
                    }}
                />
            </Box>

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

            {/* Pulsing radial glow — opacity only, so it stays on the compositor,
                but it is still an infinite loop and is dropped under
                prefers-reduced-m. */}
            <m.div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 50% 45%, rgba(225,6,0,0.05) 0%, transparent 60%)',
                    opacity: reduceMotion ? 0.5 : undefined,
                }}
                animate={reduceMotion ? undefined : { opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
        </Box>
    );
};

export default SplashBackground;
