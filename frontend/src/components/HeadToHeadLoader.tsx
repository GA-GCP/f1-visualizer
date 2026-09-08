import { Box, Container, Grid, Paper, Typography } from '@mui/material';
import { m, useReducedMotion } from 'framer-motion';
import React from 'react';
import { BORDER_SUBTLE, BRAND_RED, FONT_FAMILY, PAPER_BG } from '../theme/tokens';
import CyclingStatusLabel from './ui/CyclingStatusLabel';

/* ── Status messages that cycle during loading ── */
const STATUS_MESSAGES = [
    'INITIALIZING VERSUS MODE...',
    'LOADING DRIVER PROFILES...',
    'QUERYING CAREER STATISTICS...',
    'MAPPING ATTRIBUTE VECTORS...',
    'CALIBRATING COMPARISON ENGINE...',
];

/* ── Ghost team colors for the two animated radar blobs ── */
const GHOST_A = BRAND_RED;
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
    { label: 'TOTAL CAREER POINTS', splitA: 0.65, splitB: 0.35 },
    { label: 'TOTAL RACES', splitA: 0.48, splitB: 0.52 },
    { label: 'BEST CHAMPIONSHIP FINISH', splitA: 0.6, splitB: 0.4 },
];

/**
 * F1-themed loading animation for the Head-to-Head page.
 * Renders a ghost version of the full Versus Mode layout — two driver
 * selector placeholders, an animated radar chart, and shimmer stat bars —
 * so the transition from loading → loaded feels seamless.
 */
const HeadToHeadLoader: React.FC = () => {
    const reduceMotion = useReducedMotion();
    /* Ghost blob radius fractions for Driver A and Driver B */
    const blobA = [0.78, 0.55, 0.85, 0.45, 0.7];
    const blobB = [0.6, 0.72, 0.42, 0.8, 0.55];

    return (
        <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
            {/* ── Header (pulsing, with redacted title) ── */}
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                <m.div
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
                </m.div>
            </Box>

            {/* ── Driver selector placeholders ── */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
                {/* Driver A */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <m.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: PAPER_BG,
                                borderLeft: `4px solid ${GHOST_A}`,
                                overflow: 'hidden',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <m.div
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
                                    <m.div
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
                                    <m.div
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
                    </m.div>
                </Grid>

                {/* Driver B */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <m.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: PAPER_BG,
                                borderRight: `4px solid ${GHOST_B}`,
                                overflow: 'hidden',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'row-reverse' }}>
                                <m.div
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
                                    <m.div
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
                                    <m.div
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
                    </m.div>
                </Grid>
            </Grid>

            {/* ── Main content: Ghost Radar + Ghost Stats ── */}
            <Grid container spacing={4}>
                {/* Ghost Radar Chart */}
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
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <m.div
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Typography variant="h6" component="h2" color="text.secondary" gutterBottom>
                                    ATTRIBUTE MAPPING
                                </Typography>
                            </m.div>

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
                                            fontFamily={FONT_FAMILY}
                                        >
                                            {label}
                                        </text>
                                    );
                                })}

                                {/* Ghost blob A — draws in, then pulses */}
                                <m.path
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
                                <m.path
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
                                <m.line
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
                                <m.div
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
                                <m.div
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
                    </m.div>
                </Grid>

                {/* Ghost Career Statistics */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Paper
                            sx={{
                                p: 4,
                                bgcolor: PAPER_BG,
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <m.div
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Typography variant="h6" component="h2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                                    CAREER STATISTICS
                                </Typography>
                            </m.div>

                            {/* Ghost stat bars */}
                            {GHOST_STATS.map((stat, idx) => (
                                <Box key={stat.label} sx={{ mb: 3 }}>
                                    {/* Label row */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <m.div
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
                                        <m.div
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

                                    {/* Animated bar.

                                        Revealed with `scaleX` on absolutely-positioned
                                        halves rather than by animating `width`: these ten
                                        tweens repeat forever, and `width` is a layout
                                        property framer must drive from JS, so the page was
                                        in continuous layout for its whole loading state. */}
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            height: 10,
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            bgcolor: BORDER_SUBTLE,
                                        }}
                                    >
                                        <m.div
                                            initial={{ scaleX: 0 }}
                                            animate={reduceMotion ? { scaleX: 1 } : { scaleX: [0, 1] }}
                                            transition={{
                                                duration: 2,
                                                delay: 0.5 + idx * 0.4,
                                                ease: [0.25, 0.1, 0.25, 1],
                                                repeat: reduceMotion ? 0 : Infinity,
                                                repeatType: 'reverse',
                                                repeatDelay: 2,
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: 0,
                                                width: `${stat.splitA * 100}%`,
                                                transformOrigin: 'left',
                                                background: GHOST_A,
                                                opacity: 0.25,
                                            }}
                                        />
                                        <m.div
                                            initial={{ scaleX: 0 }}
                                            animate={reduceMotion ? { scaleX: 1 } : { scaleX: [0, 1] }}
                                            transition={{
                                                duration: 2,
                                                delay: 0.5 + idx * 0.4,
                                                ease: [0.25, 0.1, 0.25, 1],
                                                repeat: reduceMotion ? 0 : Infinity,
                                                repeatType: 'reverse',
                                                repeatDelay: 2,
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: `${stat.splitA * 100}%`,
                                                width: `${stat.splitB * 100}%`,
                                                transformOrigin: 'right',
                                                background: GHOST_B,
                                                opacity: 0.25,
                                            }}
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
                                <m.div
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
                                        // Opaque rather than blurred: this chip sits
                                        // over the ghost content's perpetual
                                        // animations, so a backdrop-filter re-sampled
                                        // and re-blurred them every frame.
                                        bgcolor: 'rgba(0,0,0,0.85)',
                                        border: '1px solid rgba(225,6,0,0.12)',
                                    }}
                                >
                                    <CyclingStatusLabel messages={STATUS_MESSAGES} />
                                </Box>
                            </Box>
                        </Paper>
                    </m.div>
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
                <m.div
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
