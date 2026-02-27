import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button, IconButton, Tooltip } from '@mui/material';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useOktaAuth } from '@okta/okta-react';
import UserSettingsModal from './UserSettingsModal';

const LayoutMain: React.FC = () => {
    const location = useLocation();
    const { oktaAuth } = useOktaAuth(); // NEW: Destructure the auth instance
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleLogout = async () => {
        await oktaAuth.signOut();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* 1. The "Broadcast Ticker" (Header) */}
            <AppBar position="sticky">
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ height: 64 }}>
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

                        <NavButton to="/" label="Live Console" icon={<SpeedIcon />} currentPath={location.pathname} />
                        <NavButton to="/historical" label="Data Vault" icon={<StorageIcon />} currentPath={location.pathname} />

                        {/* NEW: Settings Button */}
                        <Tooltip title="User Preferences">
                            <IconButton onClick={() => setIsSettingsOpen(true)} sx={{ ml: 2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>

                        {/* NEW: Logout Button */}
                        <Tooltip title="Secure Logout">
                            <IconButton
                                onClick={handleLogout}
                                sx={{ ml: 2, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                            >
                                <LogoutIcon />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </Container>
            </AppBar>

            {/* NEW: Modal Component */}
            <UserSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
