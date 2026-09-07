import React, { useCallback, useMemo } from 'react';
import { Box, Typography, Container, Autocomplete, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import LapTimeChart from '../components/LapTimeChart';
import DataVaultLoader from '../components/DataVaultLoader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { queries } from '../api/queries';
import type { RaceSession } from '../api/referenceApi';
import { buildDriverColorMap, buildDriverLabelMap } from '../utils/chartScales';
import { PAPER_BG_RAISED } from '../theme/tokens';
const HistoricalData: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const sessionKeyParam = searchParams.get('session');

    const sessionsQuery = useQuery(queries.sessions());
    const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

    // The selection lives in the URL rather than in component state: navigating
    // away unmounts the page, so a plain useState was lost on every visit to
    // another tab, and back/forward could not restore it either.
    const selectedSession = useMemo(() => {
        if (sessions.length === 0) return null;
        const fromUrl = sessionKeyParam !== null
            ? sessions.find(s => String(s.sessionKey) === sessionKeyParam)
            : undefined;
        return fromUrl ?? sessions[0];
    }, [sessions, sessionKeyParam]);

    const setSelectedSession = useCallback((session: RaceSession | null) => {
        setSearchParams(
            previous => {
                const next = new URLSearchParams(previous);
                if (session) next.set('session', String(session.sessionKey));
                else next.delete('session');
                return next;
            },
            // Choosing a session is not a navigation: it should not add an entry
            // the back button has to walk through.
            { replace: true },
        );
    }, [setSearchParams]);

    const sessionKey = selectedSession?.sessionKey;
    // Two queries rather than one Promise.all, so each is cached and
    // invalidated on its own key.
    const lapsQuery = useQuery({ ...queries.sessionLaps(sessionKey!), enabled: sessionKey !== undefined });
    const rosterQuery = useQuery({ ...queries.sessionDrivers(sessionKey!), enabled: sessionKey !== undefined });

    const laps = useMemo(() => lapsQuery.data ?? [], [lapsQuery.data]);
    const driverColorMap = useMemo(
        () => (rosterQuery.data ? buildDriverColorMap(rosterQuery.data.drivers) : {}),
        [rosterQuery.data],
    );
    const driverLabelMap = useMemo(
        () => (rosterQuery.data ? buildDriverLabelMap(rosterQuery.data.drivers) : {}),
        [rosterQuery.data],
    );

    const hasError = sessionsQuery.isError || lapsQuery.isError || rosterQuery.isError;
    const isLoading = sessionsQuery.isPending
        || (sessionKey !== undefined && (lapsQuery.isPending || rosterQuery.isPending));

    const retry = useCallback(() => {
        void sessionsQuery.refetch();
        void lapsQuery.refetch();
        void rosterQuery.refetch();
    }, [sessionsQuery, lapsQuery, rosterQuery]);

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    {/* React 19 hoists this into <head>: every route shared one
                        static title before, so browser history and tab lists were
                        indistinguishable. */}
                    <title>Data Vault · F1 Visualizer</title>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'white', mb: 1 }}>
                        💾 DATA VAULT
                    </Typography>
                    {/* MUI renders subtitle1 as an h6, so this jumped the
                        heading order straight from h1 to h6. It is a subtitle,
                        not a section heading. */}
                    <Typography variant="subtitle1" component="p" color="text.secondary">
                        Historical Analysis Engine
                    </Typography>
                </Box>

                {/* Dynamic Session Selector */}
                {/* A fixed 300px selector overflowed a 375px viewport once the
                    heading was beside it. */}
                <Box sx={{ width: { xs: '100%', sm: 300 } }}>
                    <Autocomplete
                        options={sessions}
                        getOptionLabel={(option) => `${option.year} ${option.meetingName} - ${option.sessionName}`}
                        value={selectedSession}
                        onChange={(_, newValue) => setSelectedSession(newValue)}
                        isOptionEqualToValue={(option, value) => option.sessionKey === value.sessionKey}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.sessionKey}>
                                <Typography variant="body2">{option.year} {option.meetingName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>[{option.sessionName}]</Typography>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Target Grand Prix"
                                variant="outlined"
                                size="small"
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: PAPER_BG_RAISED } }}
                            />
                        )}
                    />
                </Box>
            </Box>

            <AnimatePresence mode="wait">
                {hasError ? (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ErrorState
                            title="Session data unavailable"
                            message="The analysis service could not be reached."
                            onRetry={retry}
                        />
                    </motion.div>
                ) : isLoading ? (
                    <motion.div
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <DataVaultLoader />
                    </motion.div>
                ) : (
                    <motion.div
                        key="chart"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {laps.length === 0 ? (
                            <EmptyState
                                title="No lap data for this session"
                                message="Lap timings are only recorded for race sessions that have been ingested."
                            />
                        ) : (
                        <LapTimeChart
                            data={laps}
                            title={selectedSession ? `LAP TIMES // ${selectedSession.year} ${selectedSession.meetingName}` : undefined}
                            driverColorMap={driverColorMap}
                            driverLabelMap={driverLabelMap}
                        />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};

export default HistoricalData;