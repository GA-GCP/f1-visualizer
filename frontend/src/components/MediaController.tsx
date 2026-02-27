import React, { useState } from 'react';
import { Box, IconButton, Slider, Typography, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { playSimulation, pauseSimulation, seekSimulation } from '../api/ingestionApi';

const MediaController: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);

    const handleTogglePlay = async () => {
        if (isPlaying) {
            await pauseSimulation();
        } else {
            await playSimulation();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeekChange = (_: Event, newValue: number | number[]) => {
        setProgress(newValue as number);
    };

    const handleSeekCommitted = async (_: React.SyntheticEvent | Event, newValue: number | number[]) => {
        await seekSimulation(newValue as number);
    };

    return (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderTop: '2px solid #e10600', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconButton
                onClick={handleTogglePlay}
                color="primary"
                sx={{ bgcolor: 'rgba(225, 6, 0, 0.1)', '&:hover': { bgcolor: 'rgba(225, 6, 0, 0.2)' } }}
            >
                {isPlaying ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
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