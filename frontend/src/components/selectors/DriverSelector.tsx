import React from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { MOCK_DRIVERS, type DriverProfile } from '../../data/mockDrivers';

interface DriverSelectorProps {
    label: string;
    value: DriverProfile | null;
    onChange: (driver: DriverProfile | null) => void;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({ label, value, onChange }) => {
    return (
        <Autocomplete
            options={MOCK_DRIVERS}
            getOptionLabel={(option) => `${option.code} - ${option.name}`}
            value={value}
            onChange={(_, newValue) => onChange(newValue)}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ width: 4, bgcolor: option.teamColor, borderRadius: 1 }} />
                    <Box>
                        <Typography variant="body1">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.team}</Typography>
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
                            bgcolor: '#1e1e1e',
                            '& fieldset': { borderColor: '#444' },
                        }
                    }}
                />
            )}
        />
    );
};

export default DriverSelector;