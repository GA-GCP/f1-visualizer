import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import React, { memo } from 'react';
import type { DriverProfile } from '@/api/referenceApi';
import { PAPER_BG } from '../../theme/tokens';

interface DriverSelectorProps {
    label: string;
    options: DriverProfile[];
    value: DriverProfile | null;
    onChange: (driver: DriverProfile | null) => void;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({ label, options, value, onChange }) => {
    return (
        <Autocomplete
            options={options}
            getOptionLabel={(option) => `${option.code} - ${option.name}`}
            value={value}
            onChange={(_, newValue) => onChange(newValue)}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ width: 4, bgcolor: option.teamColor, borderRadius: 1 }} />
                    <Box>
                        <Typography variant="body1">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {option.team}
                        </Typography>
                    </Box>
                </Box>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: PAPER_BG,
                            '& fieldset': { borderColor: '#444' },
                        },
                    }}
                />
            )}
        />
    );
};

// Memoised: RaceSimulator no longer re-renders per telemetry tick, but it does
// re-render on session, driver and connection changes, and this subtree is
// expensive — MUI Autocompletes re-run their renderInput/renderOption closures
// and Emotion re-serialises every sx object.
export default memo(DriverSelector);
