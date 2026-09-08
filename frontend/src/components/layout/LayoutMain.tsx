import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button, IconButton, Tooltip } from '@mui/material';
import { Link as RouterLink, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, m, LayoutGroup } from 'framer-motion';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import UserSettingsModal from './UserSettingsModal';
import RouteFallback from '../ui/RouteFallback';
import ErrorBoundary from '../ErrorBoundary';
import { queryClient } from '../../api/queryClient';
import {useAuth0} from "@auth0/auth0-react";
import { BRAND_RED } from '../../theme/tokens';

const LayoutMain: React.FC = () => {
    const location = useLocation();
    // useOutlet(), not <Outlet />.
    //
    // <Outlet /> carries no props and reads the route context when it renders,
    // so the *exiting* wrapper rendered the NEW matched route: the incoming page
    // mounted inside the outgoing div, ran its effects, animated away, and then
    // mounted again in the entering div and ran them a second time. This is the
    // documented react-router + AnimatePresence pitfall useOutlet exists to
    // solve — it resolves the element once, here, so the exiting wrapper keeps
    // showing the page that is actually leaving.
    const outlet = useOutlet();
    const { logout } = useAuth0();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Navigation changed the content but left focus where it was — on a nav
    // button — so a screen reader announced nothing and a keyboard user carried
    // on tabbing through the header. Moving focus to the content landmark is
    // what tells both that the page changed.
    const mainRef = useRef<HTMLElement>(null);
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false; // do not steal focus on initial load
            return;
        }
        mainRef.current?.focus({ preventScroll: true });
    }, [location.pathname]);

    const handleLogout = () => {
        // Drop every cached response first: signing in as someone else on the
        // same machine must not read the previous user's data.
        queryClient.clear();
        logout({ logoutParams: { returnTo: window.location.origin } });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Keyboard users otherwise tab through the whole nav on every page.
                Visually hidden until focused. */}
            <Box
                component="a"
                href="#main"
                sx={{
                    position: 'absolute',
                    left: -9999,
                    top: 8,
                    zIndex: 2000,
                    px: 2,
                    py: 1,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderRadius: 1,
                    '&:focus': { left: 8 },
                }}
            >
                Skip to content
            </Box>

            {/* 1. The "Broadcast Ticker" (Header) */}
            <AppBar position="sticky">
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ height: 64 }}>
                        <SpeedIcon sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
                        <Typography
                            variant="h5"
                            component="div"
                            sx={{
                                flexGrow: 1,
                                fontWeight: 900,
                                fontStyle: 'italic',
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(45deg, #FFF 30%, #999 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            F1 VISUALIZER
                        </Typography>

                        {/* The links lived in generic elements, so there was no
                            navigation landmark to jump to and no indication of
                            which one was current. */}
                        <Box component="nav" aria-label="Primary" sx={{ display: 'flex' }}>
                            <LayoutGroup>
                                <NavButton to="/dashboard" label="Live Console" icon={<SpeedIcon />} currentPath={location.pathname} />
                                <NavButton to="/historical" label="Data Vault" icon={<StorageIcon />} currentPath={location.pathname} />
                                <NavButton to="/versus" label="Head-to-Head" icon={<CompareArrowsIcon />} currentPath={location.pathname} />
                            </LayoutGroup>
                        </Box>

                        <Tooltip title="User Preferences">
                            <IconButton
                                onClick={() => setIsSettingsOpen(true)}
                                aria-label="User preferences"
                                sx={{ ml: 2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Secure Logout">
                            <IconButton
                                onClick={handleLogout}
                                aria-label="Log out"
                                sx={{ ml: 2, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                            >
                                <LogoutIcon />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </Container>
            </AppBar>

            <UserSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* 2. Content Area */}
            <Container
                component="main"
                id="main"
                ref={mainRef}
                // Programmatically focusable, but not a tab stop of its own.
                tabIndex={-1}
                maxWidth="xl"
                sx={{ flexGrow: 1, py: 4, position: 'relative', zIndex: 1, outline: 'none' }}
            >
                {/* popLayout, not wait: with `wait` the incoming route could not
                    mount — and so could not begin fetching — until the 250 ms
                    exit had finished, leaving the container empty for a frame
                    and delaying every navigation by a quarter of a second.

                    Opacity only. Animating `y` promoted the entire page — every
                    Paper, the canvas, the D3 chart — into one compositing layer
                    that the AppBar's backdrop-filter then re-sampled on every
                    frame of the transition. */}
                <AnimatePresence mode="popLayout" initial={false}>
                    <m.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                        {/* Page chunks load here, not above the AppBar, so the
                            nav and footer stay put while one arrives.

                            A second boundary, keyed on the route, so a page
                            crash loses the page and not the whole shell — and
                            navigating away clears it. The app-wide boundary
                            above replaced everything with the error screen. */}
                        <ErrorBoundary key={location.pathname}>
                            <Suspense fallback={<RouteFallback />}>
                                {outlet}
                            </Suspense>
                        </ErrorBoundary>
                    </m.div>
                </AnimatePresence>
            </Container>

            {/* 3. Footer */}
            <Box component="footer" sx={{ py: 3, textAlign: 'center' }}>
                {/* The 0.5 opacity wrapper this replaces put the text below the
                    4.5:1 contrast minimum. */}
                <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: '0.1em' }}>
                    UNOFFICIAL TELEMETRY TOOL // F1 23-25
                </Typography>
            </Box>
        </Box>
    );
};

// Helper component for consistent nav buttons
const NavButton = ({ to, label, icon, currentPath }: { to: string, label: string, icon: React.ReactNode, currentPath: string }) => {
    const isActive = currentPath === to;
    return (
        <Button
            component={RouterLink}
            to={to}
            // MUI's Button does not set this from RouterLink, so the current
            // page was indicated by colour alone.
            aria-current={isActive ? 'page' : undefined}
            startIcon={icon}
            sx={{
                mx: { xs: 0.25, md: 1 },
                minWidth: { xs: 44, md: 64 },
                '& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: 0 },
                color: isActive ? 'white' : 'text.secondary',
                position: 'relative',
                borderRadius: 0,
                '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'white'
                }
            }}
        >
            {/* Icon-only below md: three labelled buttons plus the brand and two
                icon buttons overflowed a 375px bar.

                One element, hidden visually rather than removed, so the button
                keeps the same accessible name at every width — rendering the
                label twice would have put two copies in the DOM. */}
            <Box
                component="span"
                sx={{
                    position: { xs: 'absolute', md: 'static' },
                    width: { xs: '1px', md: 'auto' },
                    height: { xs: '1px', md: 'auto' },
                    overflow: { xs: 'hidden', md: 'visible' },
                    clipPath: { xs: 'inset(50%)', md: 'none' },
                    whiteSpace: { xs: 'nowrap', md: 'normal' },
                }}
            >
                {label}
            </Box>
            {isActive && (
                <m.div
                    layoutId="nav-underline"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: BRAND_RED,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
            )}
        </Button>
    );
};

export default LayoutMain;
