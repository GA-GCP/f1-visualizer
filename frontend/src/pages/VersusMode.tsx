import React, { useState } from 'react';
import { Box, Container, Grid, Typography, Paper } from '@mui/material';
import DriverSelector from '../components/selectors/DriverSelector';
import RadarChart from '../components/versus/RadarChart';
import StatComparisonBar from '../components/versus/StatComparisonBar';
import { MOCK_DRIVERS } from '../data/mockDrivers';

const VersusMode: React.FC = () => {
    const [driverA, setDriverA] = useState(MOCK_DRIVERS[0]); // Default Max
    const [driverB, setDriverB] = useState(MOCK_DRIVERS[1]); // Default Charles

    return (
        <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: -1, color: 'white' }}>
                    HEAD-TO-HEAD
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" sx={{ letterSpacing: 2 }}>
                    COMPARISON ENGINE
                </Typography>
            </Box>

            {/* Selectors */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
                {/* FIX: Removed 'item', changed 'xs/md' to 'size={{ xs: ..., md: ... }}' */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', borderLeft: `4px solid ${driverA.teamColor}` }}>
                        <DriverSelector
                            label="DRIVER A"
                            value={driverA}
                            onChange={(d) => d && setDriverA(d)}
                        />
                    </Paper>
                </Grid>
                {/* FIX: Removed 'item', changed 'xs/md' to 'size={{ xs: ..., md: ... }}' */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', borderRight: `4px solid ${driverB.teamColor}` }}>
                        <DriverSelector
                            label="DRIVER B"
                            value={driverB}
                            onChange={(d) => d && setDriverB(d)}
                        />
                    </Paper>
                </Grid>
            </Grid>

            {/* Analysis Dashboard */}
            <Grid container spacing={4}>
                {/* Center: Radar Chart */}
                {/* FIX: Removed 'item', changed 'xs/md' to 'size={{ xs: ..., md: ... }}' */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper sx={{ p: 3, bgcolor: '#1e1e1e', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            ATTRIBUTE MAPPING
                        </Typography>
                        <RadarChart driverA={driverA} driverB={driverB} />
                        <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
                            <Typography sx={{ color: driverA.teamColor, fontWeight: 'bold' }}>{driverA.code}</Typography>
                            <Typography color="text.secondary">vs</Typography>
                            <Typography sx={{ color: driverB.teamColor, fontWeight: 'bold' }}>{driverB.code}</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Right: Stat Bars */}
                {/* FIX: Removed 'item', changed 'xs/md' to 'size={{ xs: ..., md: ... }}' */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper sx={{ p: 4, bgcolor: '#1e1e1e', height: '100%' }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                            CAREER STATISTICS
                        </Typography>

                        <StatComparisonBar
                            label="Race Wins"
                            driverA={driverA}
                            driverB={driverB}
                            metric="wins"
                        />

                        <StatComparisonBar
                            label="Podium Finishes"
                            driverA={driverA}
                            driverB={driverB}
                            metric="podiums"
                        />

                        {/* Placeholder for future expansion */}
                        <Box sx={{ mt: 6, p: 2, border: '1px dashed #444', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                * Historical data aggregation from 2018-2023 seasons.
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default VersusMode;