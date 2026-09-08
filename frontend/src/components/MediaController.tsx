import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Box, IconButton, Slider, Typography, Paper, CircularProgress, Tooltip } from '@mui/material';
import { type StompSubscription } from '@stomp/stompjs';
import React, { memo, useState, useEffect } from 'react';
import { playSimulation, pauseSimulation, seekSimulation } from '../api/ingestionApi';
import { stompClient } from '../api/stompClient';
import { createLogger } from '../lib/logger';
import { useConnectionStatus } from '../realtime/useConnectionStatus';
import { BRAND_RED, PAPER_BG_RAISED } from '../theme/tokens';

interface MediaControllerProps {
    onSeek?: () => void;
}

const log = createLogger('playback');

const MediaController: React.FC<MediaControllerProps> = ({ onSeek }) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [isPending, setIsPending] = useState(false);

    // Listen to the backend's Virtual Clock playback status.
    //
    // Driven by the client's published connection state rather than a 500 ms
    // poller: a reconnect re-runs this effect, so the subscription is restored
    // without a timer running for the lifetime of the page.
    const isConnected = useConnectionStatus() === 'connected';

    useEffect(() => {
        if (!isConnected) return;

        const subscription: StompSubscription = stompClient.subscribe(
            '/topic/playback-status',
            (message) => {
                try {
                    const data: unknown = JSON.parse(message.body);
                    const progressValue = (data as { progress?: unknown }).progress;
                    if (typeof progressValue === 'number') {
                        setProgress(progressValue);
                        if (progressValue >= 100) setIsPlaying(false);
                    }
                } catch (err) {
                    log.error('Failed to parse playback status', err);
                }
            },
        );

        return () => subscription.unsubscribe();
    }, [isConnected]);

    const handleTogglePlay = async () => {
        if (isPending) return; // the control stays focusable, so guard re-entry
        setIsPending(true);
        try {
            if (isPlaying) {
                await pauseSimulation();
            } else {
                await playSimulation();
            }
            setIsPlaying(!isPlaying);
        } catch {
            log.error('Playback command failed');
        } finally {
            setIsPending(false);
        }
    };

    const handleSeekChange = (_: Event, newValue: number | number[]) => {
        setProgress(newValue as number);
    };

    const handleSeekCommitted = async (_: React.SyntheticEvent | Event, newValue: number | number[]) => {
        // Clear the trace and stale state BEFORE the seek API call.
        // This prevents in-flight STOMP packets (from the old position)
        // from contaminating the trace while the HTTP request is pending.
        onSeek?.();
        // Unlike the other two handlers this had no catch, so a seek against a
        // failing ingestion service produced an unhandled rejection, left
        // isPlaying disagreeing with the server, and told the user nothing.
        // Found by no-misused-promises rather than by anyone using it.
        try {
            await seekSimulation(newValue as number);
            // Automatically resume playing if we seek
            if (!isPlaying) {
                await playSimulation();
                setIsPlaying(true);
            }
        } catch (error) {
            log.error('Seek failed', error);
            // The server's position is now unknown, so stop claiming to play.
            setIsPlaying(false);
        }
    };

    return (
        <Paper sx={{ p: 2, bgcolor: PAPER_BG_RAISED, borderTop: `2px solid ${BRAND_RED}`, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Tooltip title={isPlaying ? 'Pause simulation' : 'Play simulation'}>
                <IconButton
                    onClick={() => void handleTogglePlay()}
                    color="primary"
                    // The control is icon-only, so without an explicit name a
                    // screen reader announced it as just "button".
                    aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
                    aria-pressed={isPlaying}
                    aria-busy={isPending}
                    // aria-disabled, not disabled: a disabled element cannot hold
                    // focus, so pressing this dropped the keyboard user back to
                    // <body> for the length of every request. The handler guards
                    // re-entry instead.
                    aria-disabled={isPending}
                    sx={{
                        bgcolor: 'rgba(225, 6, 0, 0.1)',
                        '&:hover': { bgcolor: 'rgba(225, 6, 0, 0.2)' },
                        ...(isPending && { opacity: 0.6, cursor: 'progress' }),
                    }}
                >
                    {isPending ? <CircularProgress size={28} color="inherit" /> : isPlaying ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
                </IconButton>
            </Tooltip>

            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    SIMULATION TIMELINE
                </Typography>
                <Slider
                    value={progress}
                    onChange={handleSeekChange}
                    onChangeCommitted={(event, value) => void handleSeekCommitted(event, value)}
                    aria-label="Simulation Timeline"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{
                        color: BRAND_RED,
                        height: 4,
                        // No `padding: 0`: MUI's vertical padding is the thumb's
                        // hit area, and removing it left a 16px target, below
                        // the 24px minimum.
                        '& .MuiSlider-thumb': {
                            width: 20,
                            height: 20,
                            // Enlarges the transparent hit area without changing
                            // the visual size of the thumb.
                            '&::after': { width: 32, height: 32 },
                            transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                            '&::before': { boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)' },
                            '&:hover, &.Mui-focusVisible': { boxShadow: '0px 0px 0px 8px rgb(225 6 0 / 16%)' },
                            '&.Mui-active': { width: 20, height: 20 },
                        },
                        '& .MuiSlider-rail': { opacity: 0.28 },
                    }}
                />
            </Box>
        </Paper>
    );
};

// Memoised: RaceSimulator no longer re-renders per telemetry tick, but it does
// re-render on session, driver and connection changes, and this subtree is
// expensive — MUI Autocompletes re-run their renderInput/renderOption closures
// and Emotion re-serialises every sx object.
export default memo(MediaController);
