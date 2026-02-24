import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button } from '@mui/material';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import SpeedIcon from '@mui/icons-material/Speed'; // Represents Live/Telemetry
import StorageIcon from '@mui/icons-material/Storage'; // Represents Historical Data

const LayoutMain: React.FC = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* 1. The "Command Bar" (Header) */}
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #333' }}>
                <Toolbar>
                    {/* Branding */}
                    <SpeedIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', letterSpacing: 1 }}>
                        F1 VISUALIZER
                    </Typography>

                    {/* Navigation Buttons */}
                    <Button color="inherit" component={RouterLink} to="/" startIcon={<SpeedIcon />}>
                        Live Console
                    </Button>
                    <Button color="inherit" component={RouterLink} to="/historical" startIcon={<StorageIcon />}>
                        Data Vault
                    </Button>
                </Toolbar>
            </AppBar>

            {/* 2. Content Area (Where pages render) */}
            <Container maxWidth="xl" sx={{ flexGrow: 1, py: 4 }}>
                <Outlet />
            </Container>

            {/* 3. Footer / Disclaimer */}
            <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', borderTop: '1px solid #333', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                    F1 Visualizer is an unofficial personal project. Not associated with Formula One World Championship Limited.
                </Typography>
            </Box>
        </Box>
    );
};

export default LayoutMain;
