import { createTheme } from '@mui/material';

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
        primary: { main: '#e10600' },
        secondary: { main: '#ffffff' },
        background: {
            default: '#101010',
            paper: 'rgba(20, 20, 20, 0.6)'
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255,255,255,0.7)',
        },
    },
    typography: {
        fontFamily: '"Titillium Web", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.02em' },
        h4: { fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.05em' },
        h6: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' },
        body1: { fontSize: '1.1rem' },
    },
    shape: { borderRadius: 4 },
    // MUI's own transitions (Dialog Fade, Autocomplete Grow, Slider thumb,
    // ripples) follow the OS preference. MUI's value is 'system'; framer's
    // equivalent is <MotionConfig reducedMotion="user"> below.
    motion: { reducedMotion: 'system' },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
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
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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
                    borderBottom: '2px solid #e10600',
                    boxShadow: 'none',
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '1px solid rgba(255,255,255,0.2)',
                }
            },
            variants: [
                {
                    props: { variant: 'filled', color: 'success' },
                    style: {
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        color: '#00ff00',
                        border: '1px solid #00ff00',
                        boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)',
                    }
                }
            ]
        }
    }
});
