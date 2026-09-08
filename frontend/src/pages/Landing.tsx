import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button } from '@mui/material';
import { m } from 'framer-motion';
import React from 'react';
import SplashBackground from '../components/splash/SplashBackground';
import SplashCircuit from '../components/splash/SplashCircuit';
import { BRAND_GRADIENT, FONT_FAMILY } from '../theme/tokens';

// --- Per-letter stagger text reveal (adapted from SplashScreen) ---

const TITLE_TEXT = 'F1 VISUALIZER';
const LETTERS = TITLE_TEXT.split('');

const letterContainerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06, delayChildren: 0.5 },
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

// --- Landing Page ---

const Landing: React.FC = () => {
    const { loginWithRedirect } = useAuth0();

    const handleLogin = () => {
        void loginWithRedirect();
    };

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5 }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {/* Reuse the animated 4-layer background from the splash screen */}
            <SplashBackground />

            {/* Main content — relative, above the background */}
            <Box
                sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    width: '100%',
                    px: 2,
                }}
            >
                {/* Per-letter title reveal */}
                <m.div
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
                        const t = LETTERS.length > 1 ? i / (LETTERS.length - 1) : 0;
                        const gray = Math.round(255 - t * 100); // 255 → 155
                        return (
                            <m.span
                                key={i}
                                variants={letterVariants}
                                style={{
                                    display: 'inline-block',
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: 900,
                                    fontStyle: 'italic',
                                    fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                                    letterSpacing: '-0.02em',
                                    color: `rgb(${gray}, ${gray}, ${gray})`,
                                    minWidth: letter === ' ' ? '0.3em' : undefined,
                                    willChange: 'transform, opacity, filter',
                                }}
                            >
                                {letter}
                            </m.span>
                        );
                    })}
                </m.div>

                {/* Tagline */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.5, ease: 'easeOut' }}
                >
                    <Typography
                        sx={{
                            fontFamily: FONT_FAMILY,
                            // The clamp minimum, not the preferred value, is what
                            // renders on a phone: 1.2vw is 4.5px at 375px wide, so
                            // this bottomed out at 8.8px.
                            fontSize: 'clamp(0.75rem, 1.2vw, 0.9rem)',
                            letterSpacing: '0.3em',
                            color: 'rgba(255,255,255,0.6)',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                        }}
                    >
                        REAL-TIME TELEMETRY // HISTORICAL ANALYSIS // DRIVER COMPARISON
                    </Typography>
                </m.div>

                {/* Circuit animation (continuous, perpetual) */}
                <SplashCircuit continuous />

                {/* Login button with pulsing glow.

                    This is the only interactive element on the page, so it is in
                    within ~550 ms rather than the 2.2 s it used to wait; the title
                    reveal and the rest of the decoration keep their own timing and
                    continue around it. */}
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                    style={{ position: 'relative', marginTop: 16 }}
                >
                    {/* Pulsing glow ring behind the button */}
                    <m.div
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            width: '140%',
                            height: '200%',
                            top: '-50%',
                            left: '-20%',
                            background: 'radial-gradient(ellipse, rgba(225,6,0,0.15) 0%, transparent 70%)',
                            pointerEvents: 'none',
                            zIndex: -1,
                        }}
                    />

                    <m.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <Button
                            variant="contained"
                            onClick={handleLogin}
                            sx={{
                                px: 5,
                                py: 1.8,
                                fontSize: '1rem',
                                fontWeight: 700,
                                fontFamily: FONT_FAMILY,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                background: BRAND_GRADIENT,
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 1,
                                boxShadow: '0 0 20px rgba(225,6,0,0.3), 0 0 60px rgba(225,6,0,0.1)',
                                transition: 'box-shadow 0.3s ease',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #ff1a1a 0%, #ff4040 100%)',
                                    boxShadow: '0 0 30px rgba(225,6,0,0.5), 0 0 80px rgba(225,6,0,0.2)',
                                },
                            }}
                        >
                            Login or Sign Up For An Account
                        </Button>
                    </m.div>
                </m.div>
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    position: 'absolute',
                    bottom: 32,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1,
                }}
            >
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 0.5, delay: 3.0 }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            letterSpacing: '0.15em',
                            color: 'rgba(255,255,255,0.6)',
                            fontFamily: FONT_FAMILY,
                            fontSize: '0.75rem',
                        }}
                    >
                        UNOFFICIAL TELEMETRY TOOL // F1 23-25
                    </Typography>
                </m.div>
            </Box>
        </m.div>
    );
};

export default Landing;
