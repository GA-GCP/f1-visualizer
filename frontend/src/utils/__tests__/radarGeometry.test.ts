import { describe, it, expect } from 'vitest';
import {
    angleForAxis,
    computeRadarPoints,
    createRadialScale,
    RADAR_FEATURES,
} from '../radarGeometry';

describe('angleForAxis', () => {
    it('places the first axis at -PI/2 (12 o\'clock)', () => {
        expect(angleForAxis(0)).toBeCloseTo(-Math.PI / 2);
    });

    it('evenly spaces axes around the circle', () => {
        const total = RADAR_FEATURES.length; // 5
        const step = (Math.PI * 2) / total;

        for (let i = 0; i < total; i++) {
            expect(angleForAxis(i, total)).toBeCloseTo(step * i - Math.PI / 2);
        }
    });

    it('completes a full circle over all axes', () => {
        const total = RADAR_FEATURES.length;
        const firstAngle = angleForAxis(0, total);
        const lastAnglePlusStep = angleForAxis(total, total);
        // Going total steps from the start should return to start + 2*PI
        expect(lastAnglePlusStep - firstAngle).toBeCloseTo(Math.PI * 2);
    });

    it('works with a custom total', () => {
        expect(angleForAxis(0, 4)).toBeCloseTo(-Math.PI / 2);
        expect(angleForAxis(1, 4)).toBeCloseTo(-Math.PI / 2 + Math.PI / 2);
        expect(angleForAxis(2, 4)).toBeCloseTo(-Math.PI / 2 + Math.PI);
    });
});

describe('computeRadarPoints', () => {
    const rScale = createRadialScale(100);

    it('returns exactly 6 points (5 features + closing point)', () => {
        const stats = { speed: 80, consistency: 60, aggression: 40, tireMgmt: 70, experience: 90 };
        const points = computeRadarPoints(stats, rScale);
        expect(points).toHaveLength(RADAR_FEATURES.length + 1);
    });

    it('closes the polygon by repeating the first point', () => {
        const stats = { speed: 50, consistency: 50, aggression: 50, tireMgmt: 50, experience: 50 };
        const points = computeRadarPoints(stats, rScale);
        expect(points[points.length - 1].x).toBeCloseTo(points[0].x);
        expect(points[points.length - 1].y).toBeCloseTo(points[0].y);
    });

    it('maps values through rScale to compute coordinates', () => {
        const stats = { speed: 100, consistency: 0, aggression: 0, tireMgmt: 0, experience: 0 };
        const points = computeRadarPoints(stats, rScale);

        // First axis (speed) at angle -PI/2: cos(-PI/2) = 0, sin(-PI/2) = -1
        // rScale(100) = 100
        expect(points[0].x).toBeCloseTo(100 * Math.cos(-Math.PI / 2));
        expect(points[0].y).toBeCloseTo(100 * Math.sin(-Math.PI / 2));
    });

    it('uses 0 for missing stat values', () => {
        const stats = { speed: 50 }; // other features missing
        const points = computeRadarPoints(stats, rScale);

        // consistency (index 1) should be 0 -> rScale(0) = 0
        expect(points[1].x).toBeCloseTo(0);
        expect(points[1].y).toBeCloseTo(0);
    });

    it('produces correct coordinates for a uniform value', () => {
        const value = 60;
        const stats = {
            speed: value,
            consistency: value,
            aggression: value,
            tireMgmt: value,
            experience: value,
        };
        const points = computeRadarPoints(stats, rScale);
        const r = rScale(value); // 60

        RADAR_FEATURES.forEach((_, i) => {
            const angle = angleForAxis(i);
            expect(points[i].x).toBeCloseTo(r * Math.cos(angle));
            expect(points[i].y).toBeCloseTo(r * Math.sin(angle));
        });
    });
});

describe('createRadialScale', () => {
    it('maps domain [0, 100] to range [0, radius]', () => {
        const radius = 150;
        const scale = createRadialScale(radius);

        expect(scale(0)).toBeCloseTo(0);
        expect(scale(100)).toBeCloseTo(radius);
    });

    it('linearly interpolates intermediate values', () => {
        const radius = 200;
        const scale = createRadialScale(radius);

        expect(scale(50)).toBeCloseTo(100);
        expect(scale(25)).toBeCloseTo(50);
        expect(scale(75)).toBeCloseTo(150);
    });

    it('extrapolates values outside [0, 100]', () => {
        const radius = 100;
        const scale = createRadialScale(radius);

        // d3 linear scales extrapolate by default
        expect(scale(200)).toBeCloseTo(200);
    });
});
