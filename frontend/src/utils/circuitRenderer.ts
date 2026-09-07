import { createProjection, type Bounds, type Projection } from './circuitProjection';

export type DriverHistory = Record<number, { x: number; y: number }[]>;

/**
 * A 2D context, narrowed to what the trace actually uses.
 *
 * Declared structurally so node-canvas can satisfy it in the visual-regression
 * test without a cast: the point of this module is that the test and the
 * component execute the *same* drawing code.
 */
export interface TraceContext {
    clearRect(x: number, y: number, w: number, h: number): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    fill(): void;
    arc(x: number, y: number, r: number, start: number, end: number): void;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    fillStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    lineJoin: CanvasLineJoin;
    lineCap: CanvasLineCap;
    shadowBlur: number;
    shadowColor: string;
}

export const GHOST_STROKE = 'rgba(255, 255, 255, 0.1)';
export const GHOST_DOT = 'rgba(255,255,255,0.3)';
export const DEFAULT_TEAM_COLOUR = '#e10600';
export const SELECTED_LINE_WIDTH = 4;
export const GHOST_LINE_WIDTH = 1.5;
export const SELECTED_DOT_RADIUS = 6;
export const GHOST_DOT_RADIUS = 3;
export const SELECTED_GLOW_BLUR = 15;

interface StrokeOptions {
    /** Index of the first point to draw from. A value > 0 continues an
     *  existing polyline, which is how the cached layer is appended to. */
    from?: number;
}

/**
 * Strokes one driver's polyline. Returns the number of points now drawn.
 */
export function strokeTrace(
    ctx: TraceContext,
    points: readonly { x: number; y: number }[],
    projection: Projection,
    isSelected: boolean,
    teamColour: string | undefined,
    { from = 0 }: StrokeOptions = {},
): number {
    if (points.length < 2) return points.length;

    // Continue from the previous point so appended segments join up.
    const start = Math.max(0, Math.min(from - 1, points.length - 1));
    if (start >= points.length - 1) return points.length;

    // Reset shadow state before stroking so a previous driver's glow settings
    // cannot leak into this line.
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.beginPath();
    ctx.strokeStyle = isSelected ? (teamColour || DEFAULT_TEAM_COLOUR) : GHOST_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH : GHOST_LINE_WIDTH;
    ctx.lineJoin = 'round';
    // Round caps, not the default butt: the cached layer appends each frame's
    // points as a separate sub-path, and butt caps meeting at a shared point
    // with a slightly different heading leave a visible notch.
    ctx.lineCap = 'round';

    ctx.moveTo(
        points[start].x * projection.scaleX + projection.offsetX,
        points[start].y * projection.scaleY + projection.offsetY,
    );
    for (let i = start + 1; i < points.length; i++) {
        ctx.lineTo(
            points[i].x * projection.scaleX + projection.offsetX,
            points[i].y * projection.scaleY + projection.offsetY,
        );
    }
    ctx.stroke();

    return points.length;
}

/** Draws the car marker at a driver's most recent position. */
export function drawCarDot(
    ctx: TraceContext,
    point: { x: number; y: number },
    projection: Projection,
    isSelected: boolean,
    teamColour: string | undefined,
): void {
    if (isSelected) {
        ctx.shadowBlur = SELECTED_GLOW_BLUR;
        ctx.shadowColor = teamColour || DEFAULT_TEAM_COLOUR;
    }

    ctx.beginPath();
    ctx.fillStyle = isSelected ? '#ffffff' : GHOST_DOT;
    ctx.arc(
        point.x * projection.scaleX + projection.offsetX,
        point.y * projection.scaleY + projection.offsetY,
        isSelected ? SELECTED_DOT_RADIUS : GHOST_DOT_RADIUS,
        0,
        2 * Math.PI,
    );
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
}

/**
 * Draws every driver's trace and car dot in one pass.
 *
 * Used directly by the visual-regression test, and by the component for the
 * full redraws that follow a bounds, size or selection change.
 */
export function drawFullTrace(
    ctx: TraceContext,
    history: DriverHistory,
    bounds: Bounds,
    width: number,
    height: number,
    selectedDriverId: number | undefined,
    teamColour: string | undefined,
): void {
    const projection = createProjection(bounds, width, height);

    for (const [key, points] of Object.entries(history)) {
        if (points.length < 2) continue;
        const isSelected = Number(key) === selectedDriverId;
        strokeTrace(ctx, points, projection, isSelected, teamColour);
        drawCarDot(ctx, points[points.length - 1], projection, isSelected, teamColour);
    }
}
