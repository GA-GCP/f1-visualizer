import React from 'react';
import { Box, Typography } from '@mui/material';
import type { DriverProfile } from '@/api/referenceApi.ts';

interface StatComparisonBarProps {
    label: string;
    driverA: DriverProfile;
    driverB: DriverProfile;
    metric: 'wins' | 'podiums';
}

const StatComparisonBar: React.FC<StatComparisonBarProps> = ({ label, driverA, driverB, metric }) => {
    const valA = driverA.stats[metric];
    const valB = driverB.stats[metric];
    const total = valA + valB;
    const percentageA = total === 0 ? 50 : (valA / total) * 100;

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ color: driverA.teamColor, fontWeight: 'bold' }}>
                    {valA}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {label}
                </Typography>
                <Typography variant="h6" sx={{ color: driverB.teamColor, fontWeight: 'bold' }}>
                    {valB}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', height: 10, borderRadius: 1, overflow: 'hidden', bgcolor: '#333' }}>
                <Box sx={{ width: `${percentageA}%`, bgcolor: driverA.teamColor, transition: 'width 1s' }} />
                <Box sx={{ flexGrow: 1, bgcolor: driverB.teamColor, transition: 'width 1s' }} />
            </Box>
        </Box>
    );
};

export default StatComparisonBar;