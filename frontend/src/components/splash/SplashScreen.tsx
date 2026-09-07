import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Box, Button, Typography } from '@mui/material';
import SplashBackground from './SplashBackground';
import SplashCircuit from './SplashCircuit';
import SplashProgress from './SplashProgress';
import { useSplashSequence } from './useSplashSequence';
import { rememberSplashSkip } from './splashPreference';

// --- Per-letter stagger text reveal ---

const TITLE_TEXT = 'F1 VISUALIZER';
const LETTERS = TITLE_TEXT.split('');

const letterContainerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06, delayChildren: 1.6 },
    },
};

const letterVariants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] as const },
    },
};

// --- Splash Screen ---

interface SplashScreenProps {
    onComplete: () => void;
    /** 0..1 — how much of the startup prefetch has settled. */
    readiness: number;
    /** Names of prefetch tasks that failed, surfaced rather than swallowed. */
    failures?: string[];
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, readiness, failures = [] }) => {
    const [skipped, setSkipped] = useState(false);
    const { phase, progress } = useSplashSequence(onComplete, { readiness, skipped });

    const handleSkip = useCallback(() => {
        // Remembered, so a user who has opted out once never sees it again.
        rememberSplashSkip();
        setSkipped(true);
    }, []);

    return (
        <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 1, 1] }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            role="status"
            aria-label="Loading F1 Visualizer"
        >
            {/* Animated background layers */}
            <SplashBackground />

            {/* Center content wrapper (relative, above background) */}
            <Box
                sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    width: '100%',
                    px: 2,
                }}
            >
                {/* Title text reveal */}
                <motion.div
                    variants={letterContainerVariants}
                    initial="hidden"
                    animate="visible"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    {LETTERS.map((letter, i) => {
                        // Per-letter color ramp (white → light gray) replaces
                        // the old per-span background-clip gradient that caused
                        // visible seam lines between italic glyphs.
                        const t = LETTERS.length > 1 ? i / (LETTERS.length - 1) : 0;
                        const gray = Math.round(255 - t * 100); // 255 → 155
                        return (
                            <motion.span
                                key={i}
                                variants={letterVariants}
                                style={{
                                    display: 'inline-block',
                                    fontFamily: '"Titillium Web", sans-serif',
                                    fontWeight: 900,
                                    fontStyle: 'italic',
                                    fontSize: 'clamp(2rem, 5vw, 4rem)',
                                    letterSpacing: '-0.02em',
                                    color: `rgb(${gray}, ${gray}, ${gray})`,
                                    minWidth: letter === ' ' ? '0.3em' : undefined,
                                    willChange: 'transform, opacity, filter',
                                }}
                            >
                                {letter}
                            </motion.span>
                        );
                    })}
                </motion.div>

                {/* Circuit animation */}
                <SplashCircuit phase={phase} />
            </Box>

            {/* Pit-lane progress bar */}
            <SplashProgress progress={progress} />

            {/* Prefetch failures are shown rather than swallowed. Startup does not
                block on them — the page underneath fetches and reports for
                itself — but silently arriving at an empty dashboard is worse
                than a line of explanation. */}
            {failures.length > 0 && (
                <Typography
                    role="alert"
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        bottom: 136,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'warning.light',
                        letterSpacing: '0.1em',
                        textAlign: 'center',
                        px: 2,
                    }}
                >
                    Could not preload {failures.join(', ')} — the dashboard will retry.
                </Typography>
            )}

            <Button
                onClick={handleSkip}
                size="small"
                sx={{
                    position: 'absolute',
                    bottom: 32,
                    right: 32,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.2em',
                    fontSize: '0.7rem',
                    '&:hover': { color: '#fff' },
                }}
            >
                Skip intro
            </Button>
        </motion.div>
    );
};

export default SplashScreen;
