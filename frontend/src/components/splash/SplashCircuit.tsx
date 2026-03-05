import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, animate, useMotionValueEvent } from 'framer-motion';
import { Box } from '@mui/material';
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
    phase: SplashPhase;
}

const SplashCircuit: React.FC<SplashCircuitProps> = ({ phase }) => {
    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState(0);
    const dotX = useMotionValue(0);
    const dotY = useMotionValue(0);
    const dotProgress = useMotionValue(0);

    // Measure SVG path length on mount
    useEffect(() => {
        if (pathRef.current) {
            setPathLength(pathRef.current.getTotalLength());
        }
    }, []);

    // Start the orbiting dot once the circuit finishes drawing
    const circuitDrawn = phase !== 'background';
    useEffect(() => {
        if (!circuitDrawn || pathLength === 0) return;

        // Wait for path-draw to mostly finish before starting the dot
        const delay = phase === 'circuit' ? 800 : 0;
        const timer = setTimeout(() => {
            const controls = animate(dotProgress, 1, {
                duration: 2.5,
                repeat: Infinity,
                ease: 'linear',
            });
            return () => controls.stop();
        }, delay);

        return () => clearTimeout(timer);
    }, [circuitDrawn, pathLength, phase, dotProgress]);

    // Track dot position along the path
    useMotionValueEvent(dotProgress, 'change', (v) => {
        if (pathRef.current && pathLength > 0) {
            const point = pathRef.current.getPointAtLength(v * pathLength);
            dotX.set(point.x);
            dotY.set(point.y);
        }
    });

    const showDot = phase !== 'background' && pathLength > 0;

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

                {/* Animated circuit draw */}
                <motion.path
                    ref={pathRef}
                    d={CIRCUIT_PATH}
                    fill="none"
                    stroke="#e10600"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={pathLength || 1}
                    initial={{ strokeDashoffset: pathLength || 1 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{
                        duration: 1,
                        delay: 0.2,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(225,6,0,0.4))' }}
                />

                {/* Orbiting racing dot */}
                {showDot && (
                    <motion.circle
                        cx={dotX}
                        cy={dotY}
                        r={5}
                        fill="#ffffff"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 1.0 }}
                        style={{
                            filter: 'drop-shadow(0 0 6px #e10600) drop-shadow(0 0 12px rgba(225,6,0,0.4))',
                        }}
                    />
                )}
            </svg>
        </Box>
    );
};

export default SplashCircuit;
