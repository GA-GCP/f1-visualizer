import { Box, Chip, Container, Grid, Typography, Paper } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { queries } from '../api/queries';
import HeadToHeadLoader from '../components/HeadToHeadLoader';
import DriverSelector from '../components/selectors/DriverSelector';
import ErrorState from '../components/ui/ErrorState';
import RadarChart from '../components/versus/RadarChart';
import StatComparisonBar from '../components/versus/StatComparisonBar';
import { PAPER_BG } from '../theme/tokens';
import type { DriverProfile } from '../api/referenceApi';

/**
 * Resolves one slot's driver from the URL parameter.
 *
 * `null` (absent) falls back to the default pairing; an empty string is a
 * deliberate clear and resolves to nothing.
 */
function resolveSlot(
    drivers: DriverProfile[],
    param: string | null,
    fallbackIndex: number,
): DriverProfile | null {
    if (drivers.length === 0) return null;
    if (param === null) return drivers[fallbackIndex] ?? null;
    return drivers.find((d) => String(d.id) === param) ?? null;
}

const VersusMode: React.FC = () => {
    // The pairing lives in the URL, so navigating to another tab and back — or
    // pressing the back button, or sharing the link — restores the comparison
    // instead of resetting it to the first two drivers.
    const [searchParams, setSearchParams] = useSearchParams();

    const driversQuery = useQuery(queries.drivers());
    const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);

    const baseA = useMemo(
        () => resolveSlot(drivers, searchParams.get('a'), 0),
        [drivers, searchParams],
    );
    const baseB = useMemo(
        () => resolveSlot(drivers, searchParams.get('b'), 1),
        [drivers, searchParams],
    );

    // Query caches per driver id, so re-selecting a driver is instant and the
    // requests for the two slots run in parallel rather than the serial
    // await-then-await the initial load used to do.
    const statsA = useQuery({ ...queries.driverStats(baseA?.id ?? 0), enabled: baseA !== null });
    const statsB = useQuery({ ...queries.driverStats(baseB?.id ?? 0), enabled: baseB !== null });

    const handleDriverSelect = useCallback(
        (driver: DriverProfile | null, slot: 'A' | 'B') => {
            setSearchParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    next.set(slot === 'A' ? 'a' : 'b', driver ? String(driver.id) : '');
                    return next;
                    // Picking a driver is not a navigation; it should not add a history
                    // entry the back button has to walk through.
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    // Derived, not stored: a selection shows immediately with the roster's
    // static stats and upgrades in place when the dynamic ones land, instead of
    // holding the whole page on a skeleton until both requests resolve.
    const driverA = useMemo(
        () => (baseA ? { ...baseA, stats: statsA.data ?? baseA.stats } : null),
        [baseA, statsA.data],
    );
    const driverB = useMemo(
        () => (baseB ? { ...baseB, stats: statsB.data ?? baseB.stats } : null),
        [baseB, statsB.data],
    );

    const rosterError = driversQuery.isError;

    if (rosterError) {
        return (
            <ErrorState
                title="Driver data unavailable"
                message="The analysis service could not be reached, so the comparison cannot be built."
                onRetry={() => void driversQuery.refetch()}
            />
        );
    }

    if (!driverA || !driverB) {
        return <HeadToHeadLoader />;
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                {/* React 19 hoists this into <head>: every route shared one
                    static title before, so browser history and tab lists were
                    indistinguishable. */}
                <title>Head-to-Head · F1 Visualizer</title>
                <Typography
                    variant="h3"
                    component="h1"
                    sx={{ fontWeight: 800, letterSpacing: -1, color: 'white' }}
                >
                    HEAD-TO-HEAD
                </Typography>
                {/* subtitle1 renders as an h6; this is a subtitle, not a heading. */}
                <Typography
                    variant="subtitle1"
                    component="p"
                    color="text.secondary"
                    sx={{ letterSpacing: 2 }}
                >
                    COMPARISON ENGINE
                </Typography>
            </Box>

            <Grid container spacing={4} sx={{ mb: 6 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <m.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: PAPER_BG,
                                borderLeft: `4px solid ${driverA.teamColor}`,
                            }}
                        >
                            <DriverSelector
                                label="DRIVER A"
                                options={drivers}
                                value={driverA}
                                onChange={(d) => handleDriverSelect(d, 'A')}
                            />
                        </Paper>
                    </m.div>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <m.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: PAPER_BG,
                                borderRight: `4px solid ${driverB.teamColor}`,
                            }}
                        >
                            <DriverSelector
                                label="DRIVER B"
                                options={drivers}
                                value={driverB}
                                onChange={(d) => handleDriverSelect(d, 'B')}
                            />
                        </Paper>
                    </m.div>
                </Grid>
            </Grid>

            <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 5 }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: PAPER_BG,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}
                        >
                            <Typography
                                variant="h6"
                                component="h2"
                                color="text.secondary"
                                gutterBottom
                            >
                                ATTRIBUTE MAPPING
                            </Typography>
                            <RadarChart driverA={driverA} driverB={driverB} />
                            <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
                                <Typography sx={{ color: driverA.teamColor, fontWeight: 'bold' }}>
                                    {driverA.code}
                                </Typography>
                                <Typography color="text.secondary">vs</Typography>
                                <Typography sx={{ color: driverB.teamColor, fontWeight: 'bold' }}>
                                    {driverB.code}
                                </Typography>
                            </Box>
                        </Paper>
                    </m.div>
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Paper sx={{ p: 4, bgcolor: PAPER_BG, height: '100%' }}>
                            <Typography
                                variant="h6"
                                component="h2"
                                color="text.secondary"
                                gutterBottom
                                sx={{ mb: 4 }}
                            >
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
                            <StatComparisonBar
                                label="Total Career Points"
                                driverA={driverA}
                                driverB={driverB}
                                metric="totalPoints"
                            />
                            <StatComparisonBar
                                label="Total Races"
                                driverA={driverA}
                                driverB={driverB}
                                metric="totalRaces"
                            />
                            <StatComparisonBar
                                label="Best Championship Finish"
                                driverA={driverA}
                                driverB={driverB}
                                metric="bestChampionshipFinish"
                                invert
                            />

                            {/* Teams Driven For */}
                            <Box sx={{ mt: 4 }}>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ textTransform: 'uppercase', textAlign: 'center', mb: 2 }}
                                >
                                    Teams Driven For
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.75,
                                                justifyContent: 'center',
                                            }}
                                        >
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
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.75,
                                                justifyContent: 'center',
                                            }}
                                        >
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
                    </m.div>
                </Grid>
            </Grid>
        </Container>
    );
};

export default VersusMode;
