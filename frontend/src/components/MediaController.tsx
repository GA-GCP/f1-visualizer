import React, { useState, useEffect } from 'react';
import { Box, IconButton, Slider, Typography, Paper, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { type StompSubscription } from '@stomp/stompjs';
import { playSimulation, pauseSimulation, seekSimulation } from '../api/ingestionApi';
import { stompClient } from '../api/stompClient';

interface MediaControllerProps {
    onSeek?: () => void;
}

const MediaController: React.FC<MediaControllerProps> = ({ onSeek }) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [isPending, setIsPending] = useState(false);

    // Listen to the backend's Virtual Clock playback status.
    // The interval is NOT cleared after the first connection so that
    // after a disconnect/reconnect we re-subscribe automatically.
    useEffect(() => {
        let subscription: StompSubscription | null = null;

        const checkConnection = setInterval(() => {
            if (stompClient.connected && !subscription) {
                subscription = stompClient.subscribe('/topic/playback-status', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        if (typeof data.progress === 'number') {
                            setProgress(data.progress);
                            if (data.progress >= 100) {
                                setIsPlaying(false);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to parse playback status:', err);
                    }
                });
            } else if (!stompClient.connected && subscription) {
                subscription = null;
            }
        }, 500);

        return () => {
            clearInterval(checkConnection);
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const handleTogglePlay = async () => {
        setIsPending(true);
        try {
            if (isPlaying) {
                await pauseSimulation();
            } else {
                await playSimulation();
            }
            setIsPlaying(!isPlaying);
        } catch {
            console.error('Playback command failed');
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
        await seekSimulation(newValue as number);
        // Automatically resume playing if we seek
        if (!isPlaying) {
            await playSimulation();
            setIsPlaying(true);
        }
    };

    return (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderTop: '2px solid #e10600', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconButton
                onClick={handleTogglePlay}
                color="primary"
                disabled={isPending}
                sx={{ bgcolor: 'rgba(225, 6, 0, 0.1)', '&:hover': { bgcolor: 'rgba(225, 6, 0, 0.2)' } }}
            >
                {isPending ? <CircularProgress size={28} color="inherit" /> : isPlaying ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
            </IconButton>

            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    SIMULATION TIMELINE
                </Typography>
                <Slider
                    value={progress}
                    onChange={handleSeekChange}
                    onChangeCommitted={handleSeekCommitted}
                    aria-label="Simulation Timeline"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{
                        color: '#e10600',
                        height: 4,
                        padding: 0,
                        '& .MuiSlider-thumb': {
                            width: 16,
                            height: 16,
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

export default MediaController;