import { Box } from '@mui/material';
import { m, useMotionValue, animate, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import React, { useRef, useState, useEffect } from 'react';
import { BRAND_RED } from '../../theme/tokens';
import type { SplashPhase } from './useSplashSequence';

/**
 * Original fictional circuit layout — NOT based on any real track.
 * A stylised rounded shape with two chicane S-curves on the long straights.
 */
const CIRCUIT_PATH =
    'M 150,60 ' +
    'L 400,60 ' +
    'Q 520,60 520,140 ' +
    'L 520,170 ' +
    'Q 520,210 480,220 ' +
    'L 460,210 L 440,230 ' +
    'L 380,240 ' +
    'Q 340,240 340,210 ' +
    'L 340,180 ' +
    'Q 340,150 300,150 ' +
    'L 220,150 ' +
    'Q 180,150 180,180 ' +
    'L 170,210 L 150,200 L 130,220 ' +
    'L 100,240 ' +
    'Q 60,240 60,200 ' +
    'L 60,140 ' +
    'Q 60,60 150,60 Z';

interface SplashCircuitProps {
    /** Splash-sequence phase (used by the post-login splash screen). */
    phase?: SplashPhase;
    /** When true, animates immediately and perpetually without a phase controller. */
    continuous?: boolean;
}

const SplashCircuit: React.FC<SplashCircuitProps> = ({ phase, continuous }) => {
    const measureRef = useRef<SVGPathElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState(0);
    const dotX = useMotionValue(0);
    const dotY = useMotionValue(0);
    const dotProgress = useMotionValue(0);
    const prefersReducedMotion = useReducedMotion();

    // Measure SVG path length on mount via the hidden measurement element.
    // The animated <m.path> is only rendered once pathLength > 0 so
    // Framer Motion receives the correct strokeDasharray/offset from the
    // start — avoiding the 1px-dash fallback that caused scattered dots.
    useEffect(() => {
        if (measureRef.current) {
            setPathLength(measureRef.current.getTotalLength());
        }
    }, []);

    // Start the orbiting dot once the circuit finishes drawing
    const circuitDrawn = continuous || phase !== 'background';
    useEffect(() => {
        if (!circuitDrawn || pathLength === 0) return;
        // A dot that orbits forever is precisely the kind of motion the
        // preference exists to stop, and this one runs for the life of the
        // landing page. It stays visible, parked at the start of the lap.
        if (prefersReducedMotion) return;

        let controls: ReturnType<typeof animate> | null = null;

        // Wait for path-draw to mostly finish before starting the dot.
        // In continuous mode, use a fixed delay after the draw animation.
        const delay = continuous ? 2200 : phase === 'circuit' ? 1600 : 0;
        const timer = setTimeout(() => {
            controls = animate(dotProgress, 1, {
                duration: 2.5,
                repeat: Infinity,
                ease: 'linear',
            });
        }, delay);

        return () => {
            clearTimeout(timer);
            controls?.stop();
        };
    }, [circuitDrawn, pathLength, phase, continuous, dotProgress, prefersReducedMotion]);

    // Without this the dot sits at (0,0) until the first progress change, which
    // under reduced motion — where there is no progress change — is forever.
    useEffect(() => {
        if (!pathRef.current || pathLength === 0) return;
        const start = pathRef.current.getPointAtLength(dotProgress.get() * pathLength);
        dotX.set(start.x);
        dotY.set(start.y);
    }, [pathLength, dotProgress, dotX, dotY]);

    // Track dot position along the path
    useMotionValueEvent(dotProgress, 'change', (v) => {
        if (pathRef.current && pathLength > 0) {
            const point = pathRef.current.getPointAtLength(v * pathLength);
            dotX.set(point.x);
            dotY.set(point.y);
        }
    });

    const showDot = (continuous || phase !== 'background') && pathLength > 0;

    return (
        <Box
            sx={{
                position: 'relative',
                width: '60%',
                maxWidth: 500,
                mx: 'auto',
            }}
        >
            <svg
                viewBox="0 0 580 300"
                width="100%"
                style={{ display: 'block', overflow: 'visible' }}
            >
                <defs>
                    {/* Replaces the drop-shadow filters that used to sit on the
                        orbiting dot. A gradient is rasterised once; a filter on
                        a moving element is re-rendered every frame. */}
                    <radialGradient id="f1v-dot-glow">
                        <stop offset="0%" stopColor={BRAND_RED} stopOpacity="0.55" />
                        <stop offset="45%" stopColor={BRAND_RED} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={BRAND_RED} stopOpacity="0" />
                    </radialGradient>
                </defs>
                {/* Hidden path solely for getTotalLength() measurement.
                    Rendered unconditionally so the useEffect can measure on
                    mount, but invisible (no stroke, no fill). */}
                <path ref={measureRef} d={CIRCUIT_PATH} fill="none" stroke="none" />

                {/* Faint track "shadow" outline always visible once measured */}
                {pathLength > 0 && (
                    <path
                        d={CIRCUIT_PATH}
                        fill="none"
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth={8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Animated circuit draw — only rendered once pathLength is
                    known so strokeDasharray receives the real value, not the
                    fallback of 1 which caused a 1px-dash/1px-gap pattern
                    (scattered dots along the entire path). */}
                {pathLength > 0 && (
                    <m.path
                        ref={pathRef}
                        d={CIRCUIT_PATH}
                        fill="none"
                        stroke={BRAND_RED}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={pathLength}
                        initial={{ strokeDashoffset: pathLength }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{
                            duration: 2,
                            delay: 0.4,
                            ease: [0.4, 0, 0.2, 1],
                        }}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(225,6,0,0.4))' }}
                    />
                )}

                {/* Orbiting racing dot */}
                {showDot && (
                    <m.g
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 2.0 }}
                    >
                        {/* The glow was two chained drop-shadow filters on the
                            moving dot, so the browser recomputed a filter
                            region on every frame of a perpetual animation. A
                            pre-blurred radial gradient is a single paint and
                            costs nothing extra as the dot moves. */}
                        <m.circle cx={dotX} cy={dotY} r={13} fill="url(#f1v-dot-glow)" />
                        <m.circle cx={dotX} cy={dotY} r={5} fill="#ffffff" />
                    </m.g>
                )}
            </svg>
        </Box>
    );
};

export default SplashCircuit;
