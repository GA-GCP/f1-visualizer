import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Typography } from '@mui/material';
import { useCyclingIndex } from './useCyclingIndex';
import { DUR } from '../../theme/motion';
import { FONT_FAMILY, TEXT_DISABLED } from '../../theme/tokens';

interface CyclingStatusLabelProps {
    messages: readonly string[];
    intervalMs?: number;
}

/**
 * The rotating status line shared by every loader.
 *
 * `aria-live="polite"` because it is the only indication of progress a screen
 * reader gets from these screens; the four hand-written copies announced
 * nothing.
 */
const CyclingStatusLabel: React.FC<CyclingStatusLabelProps> = ({ messages, intervalMs }) => {
    const index = useCyclingIndex(messages.length, intervalMs);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: DUR.base }}
            >
                <Typography
                    role="status"
                    aria-live="polite"
                    sx={{
                        fontSize: '0.75rem',
                        letterSpacing: '0.25em',
                        color: TEXT_DISABLED,
                        fontFamily: FONT_FAMILY,
                        textAlign: 'center',
                    }}
                >
                    {messages[index]}
                </Typography>
            </motion.div>
        </AnimatePresence>
    );
};

export default CyclingStatusLabel;
