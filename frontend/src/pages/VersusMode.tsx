import React, { useState, useEffect, useCallback } from 'react';
import { Box, Chip, Container, Grid, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import DriverSelector from '../components/selectors/DriverSelector';
import RadarChart from '../components/versus/RadarChart';
import StatComparisonBar from '../components/versus/StatComparisonBar';
import HeadToHeadLoader from '../components/HeadToHeadLoader';
import { fetchDrivers, fetchDriverStats, type DriverProfile } from '../api/referenceApi';

const VersusMode: React.FC = () => {
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [driverA, setDriverA] = useState<DriverProfile | null>(null);
    const [driverB, setDriverB] = useState<DriverProfile | null>(null);

    const handleDriverSelect = useCallback(async (driver: DriverProfile | null, slot: 'A' | 'B') => {
        if (!driver) {
            if (slot === 'A') setDriverA(null);
            else setDriverB(null);
            return;
        }

        try {
            const dynamicStats = await fetchDriverStats(driver.id);
            const updatedDriver = { ...driver, stats: dynamicStats };
            if (slot === 'A') setDriverA(updatedDriver);
            else setDriverB(updatedDriver);
        } catch (error) {
            console.error(`Failed to fetch stats for ${driver?.name}`, error);
            // Fallback to the static stats on failure
            if (slot === 'A') setDriverA(driver);
            else setDriverB(driver);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initializeDrivers = async () => {
            try {
                const data = await fetchDrivers();
                if (isMounted) {
                    setDrivers(data);
                    if (data.length > 1) {
                        // Safely await the dynamic stat fetches
                        await handleDriverSelect(data[0], 'A');
                        await handleDriverSelect(data[1], 'B');
                    }
                }
            } catch (err) {
                console.error("Failed to load master driver list", err);
            }
        };

        void initializeDrivers();

        return () => {
            isMounted = false;
        };
    }, [handleDriverSelect]);

    if (!driverA || !driverB) {
        return <HeadToHeadLoader />;
    }

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

            <Grid container spacing={4} sx={{ mb: 6 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', borderLeft: `4px solid ${driverA.teamColor}` }}>
                            <DriverSelector
                                label="DRIVER A"
                                options={drivers}
                                value={driverA}
                                onChange={(d) => { void handleDriverSelect(d, 'A'); }}
                            />
                        </Paper>
                    </motion.div>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', borderRight: `4px solid ${driverB.teamColor}` }}>
                            <DriverSelector
                                label="DRIVER B"
                                options={drivers}
                                value={driverB}
                                onChange={(d) => { void handleDriverSelect(d, 'B'); }}
                            />
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>

            <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 5 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
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
                    </motion.div>
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Paper sx={{ p: 4, bgcolor: '#1e1e1e', height: '100%' }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                                CAREER STATISTICS
                            </Typography>

                            <StatComparisonBar label="Race Wins" driverA={driverA} driverB={driverB} metric="wins" />
                            <StatComparisonBar label="Podium Finishes" driverA={driverA} driverB={driverB} metric="podiums" />
                            <StatComparisonBar label="Total Career Points" driverA={driverA} driverB={driverB} metric="totalPoints" />
                            <StatComparisonBar label="Total Races" driverA={driverA} driverB={driverB} metric="totalRaces" />
                            <StatComparisonBar label="Best Championship Finish" driverA={driverA} driverB={driverB} metric="bestChampionshipFinish" invert />

                            {/* Teams Driven For */}
                            <Box sx={{ mt: 4 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', textAlign: 'center', mb: 2 }}>
                                    Teams Driven For
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                                            {(driverA.stats.teamsDrivenFor ?? []).map((team) => (
                                                <Chip
                                                    key={team}
                                                    label={team}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'rgba(255,255,255,0.06)',
                                                        color: driverA.teamColor,
                                                        borderColor: driverA.teamColor,
                                                        border: '1px solid',
                                                        fontSize: '0.7rem',
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                                            {(driverB.stats.teamsDrivenFor ?? []).map((team) => (
                                                <Chip
                                                    key={team}
                                                    label={team}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'rgba(255,255,255,0.06)',
                                                        color: driverB.teamColor,
                                                        borderColor: driverB.teamColor,
                                                        border: '1px solid',
                                                        fontSize: '0.7rem',
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>

                            <Box sx={{ mt: 6, p: 2, border: '1px dashed #444', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    * Data derived dynamically from BigQuery Data Warehouse
                                </Typography>
                            </Box>
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>
        </Container>
    );
};

export default VersusMode;