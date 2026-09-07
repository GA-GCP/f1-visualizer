import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import type { DriverProfile } from '@/api/referenceApi.ts';

type NumericStatMetric = 'wins' | 'podiums' | 'totalPoints' | 'totalRaces' | 'bestChampionshipFinish';

interface StatComparisonBarProps {
    label: string;
    driverA: DriverProfile;
    driverB: DriverProfile;
    metric: NumericStatMetric;
    /** When true, a lower value is better (e.g. championship finish position). */
    invert?: boolean;
}

const StatComparisonBar: React.FC<StatComparisonBarProps> = ({ label, driverA, driverB, metric, invert = false }) => {
    const valA = driverA.stats[metric];
    const valB = driverB.stats[metric];
    const total = valA + valB;

    let percentageA: number;
    if (total === 0) {
        percentageA = 50;
    } else if (invert) {
        // Lower is better: give the lower value more bar width
        percentageA = (valB / total) * 100;
    } else {
        percentageA = (valA / total) * 100;
    }
    const percentageB = 100 - percentageA;

    // Format display value: for bestChampionshipFinish, show "P1", "P3", etc.
    const formatVal = (v: number) => {
        if (metric === 'bestChampionshipFinish') return v === 0 ? '—' : `P${v}`;
        return String(v);
    };

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ color: driverA.teamColor, fontWeight: 'bold' }}>
                    {formatVal(valA)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {label}
                </Typography>
                <Typography variant="h6" sx={{ color: driverB.teamColor, fontWeight: 'bold' }}>
                    {formatVal(valB)}
                </Typography>
            </Box>

            {/* The two halves are absolutely positioned at their final widths and
                revealed with `scaleX`, which is WAAPI-accelerated. Animating
                `width` instead drove ten simultaneous layout tweens from JS — and
                because the bars were flex siblings, each write invalidated the
                other's geometry too. Inside a 10 px `overflow: hidden` track the
                result is visually identical. `key` re-runs the reveal when the
                pairing changes. */}
            <Box sx={{ position: 'relative', height: 10, borderRadius: 1, overflow: 'hidden', bgcolor: '#333' }}>
                <motion.div
                    key={`${driverA.id}-a`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.2, ease: "circOut" }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: `${percentageA}%`,
                        transformOrigin: 'left',
                        backgroundColor: driverA.teamColor,
                    }}
                />
                <motion.div
                    key={`${driverB.id}-b`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.2, ease: "circOut" }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${percentageA}%`,
                        width: `${percentageB}%`,
                        transformOrigin: 'right',
                        backgroundColor: driverB.teamColor,
                    }}
                />
            </Box>
        </Box>
    );
};

export default StatComparisonBar;
