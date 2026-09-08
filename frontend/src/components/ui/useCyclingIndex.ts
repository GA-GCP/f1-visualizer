import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Steps through 0..length-1 on an interval.
 *
 * The same `useState` + `setInterval` pair was written out in four loaders.
 * Under prefers-reduced-motion it holds at the first entry: rotating text is
 * motion too, and one that cannot be paused.
 */
export function useCyclingIndex(length: number, intervalMs = 2200): number {
    const reduceMotion = useReducedMotion();
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (reduceMotion || length <= 1) return;
        const id = setInterval(() => setIndex(previous => (previous + 1) % length), intervalMs);
        return () => clearInterval(id);
    }, [length, intervalMs, reduceMotion]);

    return index;
}
