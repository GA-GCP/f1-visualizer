import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button } from '@mui/material';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';

const LayoutMain: React.FC = () => {
    const location = useLocation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* 1. The "Broadcast Ticker" (Header) */}
            <AppBar position="sticky">
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ height: 64 }}>
                        {/* Branding - F1 Style Italic/Bold */}
                        <SpeedIcon sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
                        <Typography
                            variant="h5"
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

                        {/* Navigation Buttons - With Active State styling */}
                        <NavButton to="/" label="Live Console" icon={<SpeedIcon />} currentPath={location.pathname} />
                        <NavButton to="/historical" label="Data Vault" icon={<StorageIcon />} currentPath={location.pathname} />
                    </Toolbar>
                </Container>
            </AppBar>

            {/* 2. Content Area */}
            <Container maxWidth="xl" sx={{ flexGrow: 1, py: 4, position: 'relative', zIndex: 1 }}>
                <Outlet />
            </Container>

            {/* 3. Footer */}
            <Box component="footer" sx={{ py: 3, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="caption" sx={{ letterSpacing: '0.1em' }}>
                    UNOFFICIAL TELEMETRY TOOL // F1 24
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
            startIcon={icon}
            sx={{
                mx: 1,
                color: isActive ? 'white' : 'text.secondary',
                borderBottom: isActive ? '2px solid #e10600' : '2px solid transparent',
                borderRadius: 0,
                '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'white'
                }
            }}
        >
            {label}
        </Button>
    );
};

export default LayoutMain;
