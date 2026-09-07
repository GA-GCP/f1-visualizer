/**
 * Design tokens.
 *
 * There were 144 hard-coded hex literals across 41 distinct values in src, with
 * the brand red repeated in 16 places outside the theme — so a rebrand meant a
 * find-and-replace across the whole tree, and a missed one failed silently as a
 * slightly-wrong colour rather than as a build error.
 *
 * The canvas is why these are plain constants rather than only theme entries:
 * CircuitTrace draws with `ctx.strokeStyle`, which cannot read a `sx` value.
 */

// ── Brand ──
export const BRAND_RED = '#e10600';
/** ~4.9:1 on the dark surfaces; use for brand red at body size. */
export const BRAND_RED_LIGHT = '#ff3b36';
/** Gradient partner for the login and start buttons. */
export const BRAND_RED_BRIGHT = '#ff3030';

// ── Surfaces ──
export const CANVAS_BG = '#121212';
export const PAPER_BG = '#1e1e1e';
export const PAPER_BG_RAISED = '#1a1a1a';
export const APP_BG = '#101010';
export const BORDER_SUBTLE = '#333';

// ── Text ──
/** 4.6:1 on CANVAS_BG — the floor for anything that is real copy. */
export const TEXT_DISABLED = 'rgba(255,255,255,0.6)';
/** Below 4.5:1: decorative ghost shapes only, never copy. */
export const TEXT_GHOST = 'rgba(255,255,255,0.3)';

// ── Tyre compounds ──
export type TyreCompound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';

export const COMPOUND_COLOURS: Record<TyreCompound, string> = {
    SOFT: BRAND_RED,
    MEDIUM: '#ffd700',
    HARD: '#ffffff',
    INTERMEDIATE: '#43b02a',
    WET: '#2196f3',
};

/** Unknown compounds fall back to the wet blue rather than to nothing. */
export const COMPOUND_FALLBACK = COMPOUND_COLOURS.WET;

/**
 * Used when a session roster carries no team colour. Each is at least 3:1
 * against CANVAS_BG so a chart line stays distinguishable.
 */
export const TEAM_FALLBACK_COLOURS = [
    BRAND_RED, '#00D2BE', '#3b6bff', '#FF8700', '#00a08a',
    '#5c8fb8', '#B6BABD', '#C92D4B', '#5E8FAA', '#27F4D2',
] as const;

// ── Type ──
export const FONT_FAMILY = '"Titillium Web", "Roboto", "Helvetica", "Arial", sans-serif';

// ── Composite values ──
// Written here rather than inline so the brand colours appear once each.

/** Repeats once across a 200%-wide child, so translating -50% loops seamlessly. */
export const SHIMMER_GRADIENT =
    `linear-gradient(90deg, ${BRAND_RED} 0%, ${BRAND_RED_BRIGHT} 25%, ${BRAND_RED} 50%, `
    + `${BRAND_RED_BRIGHT} 75%, ${BRAND_RED} 100%)`;

/** The primary call-to-action fill. */
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_RED} 0%, ${BRAND_RED_BRIGHT} 100%)`;
