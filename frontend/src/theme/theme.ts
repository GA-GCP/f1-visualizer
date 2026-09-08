import { createTheme } from '@mui/material';
import { cssEase, DUR, EASE } from './motion';
import { APP_BG, BRAND_RED, BRAND_RED_LIGHT, FONT_FAMILY, TEXT_DISABLED } from './tokens';

/**
 * The broadcast theme.
 *
 * Extracted from App.tsx so it can be asserted on directly in tests — the
 * focus ring and the reduced-motion mode are both opt-ins that a future theme
 * refactor could silently drop.
 */
export const broadcastTheme = createTheme({
    // MUI 9 renders no focus ring unless this option is passed, so every
    // button in the app was operable by keyboard but invisible to it.
    // White gives 18:1 on these dark surfaces; the default (primary #e10600)
    // is 3.8:1 and disappears entirely on the red contained buttons.
    focusVisible: { outlineColor: '#ffffff', outlineWidth: 2, outlineOffset: 2 },
    palette: {
        mode: 'dark',
        primary: {
            main: BRAND_RED,
            // #e10600 is only 3.8:1 on the dark surfaces, which is fine for
            // large headings but not for body-sized text. Use `primary.light`
            // wherever brand red carries small copy.
            light: BRAND_RED_LIGHT,
        },
        secondary: { main: '#ffffff' },
        background: {
            default: APP_BG,
            paper: 'rgba(20, 20, 20, 0.6)',
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255,255,255,0.7)',
            // 4.6:1 on #121212 — the floor for anything that is real copy
            // rather than decoration. Ad-hoc alphas around 0.35 were being used
            // for readable text at roughly 3:1.
            disabled: TEXT_DISABLED,
        },
    },
    typography: {
        fontFamily: FONT_FAMILY,
        // Titillium Web has proportional figures by default, so a changing
        // telemetry value shifted everything after it sideways on every commit.
        allVariants: { fontVariantNumeric: 'tabular-nums' },
        h1: { fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.02em' },
        h4: {
            fontWeight: 700,
            fontStyle: 'italic',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
        },
        h6: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' },
        body1: { fontSize: '1.1rem' },
    },
    shape: { borderRadius: 4 },
    // MUI's transitions ran on their own defaults, so its Dialog, Grow and
    // ripple timings had no relationship to framer's. Both now come from
    // theme/motion.ts; MUI wants milliseconds.
    transitions: {
        duration: {
            shortest: DUR.fast * 1000,
            shorter: DUR.base * 1000,
            short: DUR.base * 1000,
            standard: DUR.slow * 1000,
            complex: DUR.reveal * 1000,
        },
        easing: {
            easeOut: cssEase(EASE.out),
            easeIn: cssEase(EASE.in),
            easeInOut: cssEase(EASE.inOut),
            sharp: cssEase(EASE.inOut),
        },
    },
    // MUI's own transitions (Dialog Fade, Autocomplete Grow, Slider thumb,
    // ripples) follow the OS preference. MUI's value is 'system'; framer's
    // equivalent is <MotionConfig reducedMotion="user"> below.
    motion: { reducedMotion: 'system' },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                html: {
                    // Reserve the scrollbar gutter permanently. /dashboard forces
                    // 100vh and the other routes do not, so the scrollbar
                    // appeared and disappeared mid-navigation and shifted the
                    // whole page horizontally as it did.
                    scrollbarGutter: 'stable',
                },
                body: {
                    minHeight: '100vh',
                    backgroundColor: '#000000',
                    // The gradient lives on a fixed pseudo-element rather than on
                    // the body with `background-attachment: fixed`, which is a
                    // documented Chromium scroll-repaint trigger: it re-rasterised
                    // a viewport-sized gradient on every scroll tick, and moved
                    // every blurred surface relative to its backdrop as it did so.
                    '&::before': {
                        content: '""',
                        position: 'fixed',
                        inset: 0,
                        zIndex: -1,
                        pointerEvents: 'none',
                        background: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 100%)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    // No backdropFilter: every Paper in the app overrides this
                    // colour with an opaque one, so the blurred backdrop was
                    // computed on all 15 of them and then covered up entirely.
                    backgroundColor: 'rgba(30, 30, 30, 0.6)',
                    border: `1px solid rgba(255, 255, 255, 0.1)`,
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    // Kept deliberately: the bar is genuinely translucent, so this
                    // is the only blur in the app the user can actually see. It is
                    // also much cheaper now that the backdrop behind it no longer
                    // re-rasterises on every scroll tick.
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: `2px solid ${BRAND_RED}`,
                    boxShadow: 'none',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '1px solid rgba(255,255,255,0.2)',
                },
            },
            variants: [
                {
                    props: { variant: 'filled', color: 'success' },
                    style: {
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        color: '#00ff00',
                        border: '1px solid #00ff00',
                        boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)',
                    },
                },
            ],
        },
    },
});
