/**
 * Motion tokens.
 *
 * There were 14 distinct durations and 8 easings scattered across components,
 * with MUI's own transition system left on its defaults — three uncoordinated
 * timing vocabularies in one app. Both systems are fed from here.
 *
 * Seconds, because that is framer's unit; MUI's milliseconds are derived in
 * theme.ts rather than written out a second time.
 */
export const DUR = {
    fast: 0.15,
    base: 0.25,
    slow: 0.45,
    reveal: 0.6,
} as const;

export const EASE = {
    out: [0.2, 0.65, 0.3, 0.9],
    inOut: [0.4, 0, 0.2, 1],
    in: [0.4, 0, 1, 1],
} as const;

export const SPRING = {
    /** The nav underline's FLIP transition. */
    snappy: { type: 'spring', stiffness: 500, damping: 35 },
} as const;

/** `cubic-bezier(...)` string for CSS and MUI, from the same array. */
export function cssEase(
    ease: readonly [number, number, number, number] | readonly number[],
): string {
    return `cubic-bezier(${ease.join(', ')})`;
}

// ── Reusable variants ──

export const fadeUp = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
    transition: { duration: DUR.base, ease: EASE.out },
} as const;

export const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: DUR.base, ease: EASE.out },
} as const;

/** Staggered container/child pair for the telemetry readout reveal. */
export const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
} as const;

export const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: DUR.base } },
} as const;
