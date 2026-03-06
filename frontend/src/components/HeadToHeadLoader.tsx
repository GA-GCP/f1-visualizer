import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Container, Grid, Paper, Typography } from '@mui/material';

/* ── Status messages that cycle during loading ── */
const STATUS_MESSAGES = [
    'INITIALIZING VERSUS MODE...',
    'LOADING DRIVER PROFILES...',
    'QUERYING CAREER STATISTICS...',
    'MAPPING ATTRIBUTE VECTORS...',
    'CALIBRATING COMPARISON ENGINE...',
];

/* ── Ghost team colors for the two animated radar blobs ── */
const GHOST_A = '#e10600';
const GHOST_B = '#00D2BE';

/* ── Radar chart geometry ── */
const RADAR_SIZE = 500;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 170;
const LEVELS = 5;
const FEATURES = ['SPEED', 'CONSISTENCY', 'AGGRESSION', 'TIRE MGMT', 'EXPERIENCE'];
const ANGLE_SLICE = (Math.PI * 2) / FEATURES.length;

/** Compute point on the radar at a given axis index and radius fraction (0-1) */
function radarPoint(i: number, fraction: number): { x: number; y: number } {
    const angle = ANGLE_SLICE * i - Math.PI / 2;
    return {
        x: RADAR_CX + RADAR_R * fraction * Math.cos(angle),
        y: RADAR_CY + RADAR_R * fraction * Math.sin(angle),
    };
}

/** Build a closed polygon path from an array of radius fractions per axis */
function radarPath(fractions: number[]): string {
    return (
        fractions
            .map((f, i) => {
                const { x, y } = radarPoint(i, f);
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ') + ' Z'
    );
}

/* ── Ghost stat bar config ── */
const GHOST_STATS = [
    { label: 'RACE WINS', splitA: 0.55, splitB: 0.45 },
    { label: 'PODIUM FINISHES', splitA: 0.4, splitB: 0.6 },
];

/**
 * F1-themed loading animation for the Head-to-Head page.
 * Renders a ghost version of the full Versus Mode layout — two driver
 * selector placeholders, an animated radar chart, and shimmer stat bars —
 * so the transition from loading → loaded feels seamless.
 */
const HeadToHeadLoader: React.FC = () => {
    const [msgIdx, setMsgIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(
            () => setMsgIdx((p) => (p + 1) % STATUS_MESSAGES.length),
            2200,
        );
        return () => clearInterval(id);
    }, []);

    /* Ghost blob radius fractions for Driver A and Driver B */
    const blobA = [0.78, 0.55, 0.85, 0.45, 0.7];
    const blobB = [0.6, 0.72, 0.42, 0.8, 0.55];

    return (
        <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
            {/* ── Header (pulsing, with redacted title) ── */}
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                <motion.div
                    animate={{ opacity: [0.3, 0.65, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Typography
                        variant="h3"
                        sx={{ fontWeight: 800, letterSpacing: -1, color: 'white' }}
                    >
                        HEAD-TO-HEAD
                    </Typography>
                    <Typography
                        variant="subtitle1"
                        sx={{ letterSpacing: 2, color: 'rgba(255,255,255,0.25)' }}
                    >
                        COMPARISON ENGINE
                    </Typography>
                </motion.div>
            </Box>

            {/* ── Driver selector placeholders ── */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
                {/* Driver A */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: '#1e1e1e',
                                borderLeft: `4px solid ${GHOST_A}`,
                                overflow: 'hidden',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <motion.div
                                    animate={{ opacity: [0.08, 0.2, 0.08] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        background: GHOST_A,
                                    }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <motion.div
                                        animate={{ opacity: [0.06, 0.15, 0.06] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                        style={{
                                            height: 14,
                                            width: '60%',
                                            borderRadius: 2,
                                            background: 'rgba(255,255,255,0.15)',
                                            marginBottom: 8,
                                        }}
                                    />
                                    <motion.div
                                        animate={{ opacity: [0.04, 0.1, 0.04] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                                        style={{
                                            height: 10,
                                            width: '40%',
                                            borderRadius: 2,
                                            background: 'rgba(255,255,255,0.08)',
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Paper>
                    </motion.div>
                </Grid>

                {/* Driver B */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: '#1e1e1e',
                                borderRight: `4px solid ${GHOST_B}`,
                                overflow: 'hidden',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'row-reverse' }}>
                                <motion.div
                                    animate={{ opacity: [0.08, 0.2, 0.08] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        background: GHOST_B,
                                    }}
                                />
                                <Box sx={{ flex: 1, textAlign: 'right' }}>
                                    <motion.div
                                        animate={{ opacity: [0.06, 0.15, 0.06] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                                        style={{
                                            height: 14,
                                            width: '60%',
                                            borderRadius: 2,
                                            background: 'rgba(255,255,255,0.15)',
                                            marginBottom: 8,
                                            marginLeft: 'auto',
                                        }}
                                    />
                                    <motion.div
                                        animate={{ opacity: [0.04, 0.1, 0.04] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
                                        style={{
                                            height: 10,
                                            width: '40%',
                                            borderRadius: 2,
                                            background: 'rgba(255,255,255,0.08)',
                                            marginLeft: 'auto',
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>

            {/* ── Main content: Ghost Radar + Ghost Stats ── */}
            <Grid container spacing={4}>
                {/* Ghost Radar Chart */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: '#1e1e1e',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <motion.div
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    ATTRIBUTE MAPPING
                                </Typography>
                            </motion.div>

                            <svg
                                viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
                                style={{ width: '100%', height: 'auto', maxHeight: 400 }}
                            >
                                {/* Grid web rings */}
                                {Array.from({ length: LEVELS }, (_, lvl) => {
                                    const frac = (lvl + 1) / LEVELS;
                                    const points = FEATURES.map((_, i) => {
                                        const { x, y } = radarPoint(i, frac);
                                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ');
                                    return (
                                        <polygon
                                            key={`ring${lvl}`}
                                            points={points}
                                            fill="none"
                                            stroke="rgba(255,255,255,0.06)"
                                            strokeWidth={1}
                                        />
                                    );
                                })}

                                {/* Axis spokes */}
                                {FEATURES.map((_, i) => {
                                    const { x, y } = radarPoint(i, 1);
                                    return (
                                        <line
                                            key={`spoke${i}`}
                                            x1={RADAR_CX}
                                            y1={RADAR_CY}
                                            x2={x}
                                            y2={y}
                                            stroke="rgba(255,255,255,0.08)"
                                            strokeWidth={1.5}
                                        />
                                    );
                                })}

                                {/* Feature labels */}
                                {FEATURES.map((label, i) => {
                                    const { x, y } = radarPoint(i, 1.18);
                                    return (
                                        <text
                                            key={`label${i}`}
                                            x={x}
                                            y={y}
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            fill="rgba(255,255,255,0.12)"
                                            fontSize={11}
                                            fontFamily="Titillium Web, sans-serif"
                                        >
                                            {label}
                                        </text>
                                    );
                                })}

                                {/* Ghost blob A — draws in, then pulses */}
                                <motion.path
                                    d={radarPath(blobA)}
                                    fill={GHOST_A}
                                    fillOpacity={0.06}
                                    stroke={GHOST_A}
                                    strokeWidth={2}
                                    initial={{ pathLength: 0, strokeOpacity: 0 }}
                                    animate={{ pathLength: 1, strokeOpacity: 0.25 }}
                                    transition={{
                                        pathLength: {
                                            duration: 2.5,
                                            delay: 0.3,
                                            ease: [0.25, 0.1, 0.25, 1],
                                            repeat: Infinity,
                                            repeatType: 'reverse',
                                            repeatDelay: 1.5,
                                        },
                                        strokeOpacity: { duration: 0.6, delay: 0.3 },
                                    }}
                                />

                                {/* Ghost blob B — draws in staggered */}
                                <motion.path
                                    d={radarPath(blobB)}
                                    fill={GHOST_B}
                                    fillOpacity={0.06}
                                    stroke={GHOST_B}
                                    strokeWidth={2}
                                    initial={{ pathLength: 0, strokeOpacity: 0 }}
                                    animate={{ pathLength: 1, strokeOpacity: 0.25 }}
                                    transition={{
                                        pathLength: {
                                            duration: 2.5,
                                            delay: 0.8,
                                            ease: [0.25, 0.1, 0.25, 1],
                                            repeat: Infinity,
                                            repeatType: 'reverse',
                                            repeatDelay: 1.5,
                                        },
                                        strokeOpacity: { duration: 0.6, delay: 0.8 },
                                    }}
                                />

                                {/* Rotating sweep line */}
                                <defs>
                                    <linearGradient id="h2h-sweep" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="rgba(225,6,0,0)" />
                                        <stop offset="100%" stopColor="rgba(225,6,0,0.2)" />
                                    </linearGradient>
                                </defs>
                                <motion.line
                                    x1={RADAR_CX}
                                    y1={RADAR_CY}
                                    x2={RADAR_CX + RADAR_R}
                                    y2={RADAR_CY}
                                    stroke="url(#h2h-sweep)"
                                    strokeWidth={2}
                                    style={{ transformOrigin: `${RADAR_CX}px ${RADAR_CY}px` }}
                                    animate={{ rotate: 360 }}
                                    transition={{
                                        duration: 6,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    }}
                                />
                            </svg>

                            {/* Ghost driver code labels */}
                            <Box sx={{ mt: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
                                <motion.div
                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{
                                        width: 36,
                                        height: 14,
                                        borderRadius: 2,
                                        background: GHOST_A,
                                    }}
                                />
                                <Typography color="text.secondary" sx={{ opacity: 0.3 }}>
                                    vs
                                </Typography>
                                <motion.div
                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                                    style={{
                                        width: 36,
                                        height: 14,
                                        borderRadius: 2,
                                        background: GHOST_B,
                                    }}
                                />
                            </Box>
                        </Paper>
                    </motion.div>
                </Grid>

                {/* Ghost Career Statistics */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Paper
                            sx={{
                                p: 4,
                                bgcolor: '#1e1e1e',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <motion.div
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                                    CAREER STATISTICS
                                </Typography>
                            </motion.div>

                            {/* Ghost stat bars */}
                            {GHOST_STATS.map((stat, idx) => (
                                <Box key={stat.label} sx={{ mb: 3 }}>
                                    {/* Label row */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <motion.div
                                            animate={{ opacity: [0.08, 0.22, 0.08] }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                                delay: idx * 0.3,
                                            }}
                                            style={{
                                                width: 28,
                                                height: 16,
                                                borderRadius: 2,
                                                background: GHOST_A,
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'rgba(255,255,255,0.12)',
                                                textTransform: 'uppercase',
                                                letterSpacing: 1,
                                            }}
                                        >
                                            {stat.label}
                                        </Typography>
                                        <motion.div
                                            animate={{ opacity: [0.08, 0.22, 0.08] }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                                delay: idx * 0.3 + 0.4,
                                            }}
                                            style={{
                                                width: 28,
                                                height: 16,
                                                borderRadius: 2,
                                                background: GHOST_B,
                                            }}
                                        />
                                    </Box>

                                    {/* Animated bar */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            height: 10,
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            bgcolor: '#333',
                                        }}
                                    >
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stat.splitA * 100}%` }}
                                            transition={{
                                                duration: 2,
                                                delay: 0.5 + idx * 0.4,
                                                ease: [0.25, 0.1, 0.25, 1],
                                                repeat: Infinity,
                                                repeatType: 'reverse',
                                                repeatDelay: 2,
                                            }}
                                            style={{ background: GHOST_A, opacity: 0.25 }}
                                        />
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stat.splitB * 100}%` }}
                                            transition={{
                                                duration: 2,
                                                delay: 0.5 + idx * 0.4,
                                                ease: [0.25, 0.1, 0.25, 1],
                                                repeat: Infinity,
                                                repeatType: 'reverse',
                                                repeatDelay: 2,
                                            }}
                                            style={{ background: GHOST_B, opacity: 0.25 }}
                                        />
                                    </Box>
                                </Box>
                            ))}

                            {/* Ghost footnote */}
                            <Box
                                sx={{
                                    mt: 6,
                                    p: 2,
                                    border: '1px dashed rgba(255,255,255,0.06)',
                                    borderRadius: 1,
                                }}
                            >
                                <motion.div
                                    animate={{ opacity: [0.04, 0.1, 0.04] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{
                                        height: 8,
                                        width: '70%',
                                        borderRadius: 2,
                                        background: 'rgba(255,255,255,0.08)',
                                    }}
                                />
                            </Box>

                            {/* ── Centered status message overlay ── */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 3,
                                        py: 1.5,
                                        borderRadius: 1,
                                        bgcolor: 'rgba(0,0,0,0.55)',
                                        backdropFilter: 'blur(4px)',
                                        border: '1px solid rgba(225,6,0,0.12)',
                                    }}
                                >
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={msgIdx}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{ duration: 0.25 }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    letterSpacing: '0.25em',
                                                    color: 'rgba(255,255,255,0.4)',
                                                    fontFamily: '"Titillium Web", sans-serif',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {STATUS_MESSAGES[msgIdx]}
                                            </Typography>
                                        </motion.div>
                                    </AnimatePresence>
                                </Box>
                            </Box>
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>

            {/* ── Bottom shimmer bar ── */}
            <Box
                sx={{
                    mt: 3,
                    height: 2,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                <motion.div
                    style={{
                        height: '100%',
                        width: '30%',
                        background:
                            'linear-gradient(90deg, transparent, rgba(225,6,0,0.3), transparent)',
                    }}
                    animate={{ x: ['-100%', '400%'] }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            </Box>
        </Container>
    );
};

export default HeadToHeadLoader;
