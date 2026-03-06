import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Paper, Typography } from '@mui/material';

/* ── Status messages that cycle during loading ── */
const STATUS_MESSAGES = [
    'ACCESSING DATA VAULT...',
    'DECRYPTING TELEMETRY...',
    'LOADING LAP RECORDS...',
    'COMPILING DRIVER DATA...',
    'BUILDING VISUALIZATION...',
];

/* ── Ghost chart line colors (matches real team palette) ── */
const GHOST_COLORS = ['#e10600', '#00D2BE', '#0600EF', '#FF8700', '#006F62'];

/* ── SVG layout matching the real chart proportions ── */
const SVG_W = 800;
const SVG_H = 400;
const MARGIN = { top: 20, right: 80, bottom: 40, left: 50 };
const INNER_W = SVG_W - MARGIN.left - MARGIN.right;
const INNER_H = SVG_H - MARGIN.top - MARGIN.bottom;

/** Deterministic pseudo-random for consistent paths across renders */
function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/** Generate a wavy ghost line resembling a lap-time trace */
function generateGhostPath(index: number): string {
    const rand = seededRandom(index * 1337 + 42);
    const segments = 25;
    const baseY = INNER_H * (0.2 + index * 0.14);
    const points: string[] = [];

    for (let i = 0; i <= segments; i++) {
        const x = MARGIN.left + (i / segments) * INNER_W;
        const noise = (rand() - 0.5) * INNER_H * 0.16;
        const y = MARGIN.top + baseY + noise;
        points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    return points.join(' ');
}

/**
 * F1-themed loading animation for the Data Vault page.
 * Renders inside the same Paper container as LapTimeChart so the
 * transition from loading → loaded feels seamless.
 */
const DataVaultLoader: React.FC = () => {
    const [msgIdx, setMsgIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(
            () => setMsgIdx((p) => (p + 1) % STATUS_MESSAGES.length),
            2200,
        );
        return () => clearInterval(id);
    }, []);

    const paths = useMemo(
        () => GHOST_COLORS.map((_, i) => generateGhostPath(i)),
        [],
    );

    return (
        <Paper
            sx={{
                p: 3,
                bgcolor: '#1e1e1e',
                color: 'white',
                overflow: 'hidden',
            }}
        >
            {/* ── Title (pulsing, redacted race name) ── */}
            <motion.div
                animate={{ opacity: [0.3, 0.65, 0.3] }}
                transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            >
                <Typography variant="h6" color="primary" gutterBottom>
                    LAP TIMES // ████████
                </Typography>
            </motion.div>

            {/* ── Animated chart preview area ── */}
            <Box sx={{ width: '100%', position: 'relative' }}>
                <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                    {/* Faint grid */}
                    {Array.from({ length: 8 }, (_, i) => {
                        const y = MARGIN.top + (i / 7) * INNER_H;
                        return (
                            <line
                                key={`h${i}`}
                                x1={MARGIN.left}
                                y1={y}
                                x2={MARGIN.left + INNER_W}
                                y2={y}
                                stroke="rgba(255,255,255,0.04)"
                                strokeWidth={1}
                            />
                        );
                    })}
                    {Array.from({ length: 12 }, (_, i) => {
                        const x = MARGIN.left + (i / 11) * INNER_W;
                        return (
                            <line
                                key={`v${i}`}
                                x1={x}
                                y1={MARGIN.top}
                                x2={x}
                                y2={MARGIN.top + INNER_H}
                                stroke="rgba(255,255,255,0.04)"
                                strokeWidth={1}
                            />
                        );
                    })}

                    {/* Faint axis labels */}
                    <text
                        x={SVG_W / 2}
                        y={SVG_H - 5}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.08)"
                        fontSize={11}
                        fontFamily="Titillium Web, sans-serif"
                    >
                        LAP NUMBER
                    </text>
                    <text
                        transform="rotate(-90)"
                        x={-SVG_H / 2}
                        y={14}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.08)"
                        fontSize={11}
                        fontFamily="Titillium Web, sans-serif"
                    >
                        LAP DURATION (s)
                    </text>

                    {/* Ghost chart lines — draw in / out continuously */}
                    {paths.map((d, i) => (
                        <motion.path
                            key={i}
                            d={d}
                            fill="none"
                            stroke={GHOST_COLORS[i]}
                            strokeWidth={2}
                            strokeLinecap="round"
                            initial={{ pathLength: 0, strokeOpacity: 0 }}
                            animate={{ pathLength: 1, strokeOpacity: 0.2 }}
                            transition={{
                                pathLength: {
                                    duration: 3,
                                    delay: i * 0.4,
                                    ease: [0.25, 0.1, 0.25, 1],
                                    repeat: Infinity,
                                    repeatType: 'reverse',
                                    repeatDelay: 1,
                                },
                                strokeOpacity: {
                                    duration: 0.5,
                                    delay: i * 0.4,
                                },
                            }}
                        />
                    ))}

                    {/* Vertical scan line */}
                    <defs>
                        <linearGradient
                            id="dvl-scan-grad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="rgba(225,6,0,0)" />
                            <stop
                                offset="50%"
                                stopColor="rgba(225,6,0,0.25)"
                            />
                            <stop
                                offset="100%"
                                stopColor="rgba(225,6,0,0)"
                            />
                        </linearGradient>
                    </defs>
                    <motion.rect
                        y={MARGIN.top}
                        width={2}
                        height={INNER_H}
                        fill="url(#dvl-scan-grad)"
                        initial={{ x: MARGIN.left }}
                        animate={{ x: MARGIN.left + INNER_W }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    />

                    {/* Ghost legend placeholders */}
                    {GHOST_COLORS.map((color, i) => (
                        <g
                            key={`leg${i}`}
                            transform={`translate(${MARGIN.left + INNER_W + 10}, ${MARGIN.top + i * 18})`}
                        >
                            <motion.rect
                                width={12}
                                height={12}
                                fill={color}
                                animate={{ opacity: [0.08, 0.2, 0.08] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: i * 0.2,
                                }}
                            />
                            <motion.rect
                                x={16}
                                y={2}
                                width={40}
                                height={8}
                                rx={2}
                                fill="rgba(255,255,255,0.06)"
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: i * 0.2,
                                }}
                            />
                        </g>
                    ))}
                </svg>

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
                                        fontFamily:
                                            '"Titillium Web", sans-serif',
                                        textAlign: 'center',
                                    }}
                                >
                                    {STATUS_MESSAGES[msgIdx]}
                                </Typography>
                            </motion.div>
                        </AnimatePresence>
                    </Box>
                </Box>
            </Box>

            {/* ── Bottom shimmer bar ── */}
            <Box
                sx={{
                    mt: 2,
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
        </Paper>
    );
};

export default DataVaultLoader;
