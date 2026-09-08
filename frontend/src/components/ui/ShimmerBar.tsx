import { Box } from '@mui/material';
import { m, useReducedMotion } from 'framer-motion';
import React from 'react';
import { SHIMMER_GRADIENT } from '../../theme/tokens';

interface ShimmerBarProps {
    /** Track height in pixels. */
    height?: number;
    /** Fill width, for a determinate bar. Defaults to the full track. */
    width?: string;
}

/**
 * The pit-lane progress bar, shared by the loaders and the splash.
 *
 * Driven by a transform on an oversized child rather than by
 * `backgroundPosition`, which is not compositor-accelerated: framer had to
 * write the inline style from JS on every frame.
 */
const ShimmerBar: React.FC<ShimmerBarProps> = ({ height = 4, width = '100%' }) => {
    const reduceMotion = useReducedMotion();

    return (
        <Box
            role="progressbar"
            aria-label="Loading"
            sx={{
                height,
                bgcolor: 'rgba(255,255,255,0.08)',
                borderRadius: height / 2,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <Box sx={{ height: '100%', width, overflow: 'hidden', position: 'relative' }}>
                <m.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '200%',
                        height: '100%',
                        background: SHIMMER_GRADIENT,
                    }}
                    animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
            </Box>
        </Box>
    );
};

export default ShimmerBar;
