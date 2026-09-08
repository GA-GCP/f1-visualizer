import { describe, it, expect } from 'vitest';
import { broadcastTheme } from '../theme';

describe('broadcastTheme', () => {
    it('opts in to the MUI focus ring', () => {
        // MUI 9 renders no focus ring at all unless createTheme receives this
        // option, so dropping it in a refactor would silently make every button
        // in the app unusable by keyboard.
        expect(broadcastTheme.focusVisible).toBeDefined();
        expect(broadcastTheme.focusVisible).toMatchObject({
            outlineColor: '#ffffff',
            outlineWidth: 2,
        });
    });

    it('follows the OS reduced-motion preference for MUI transitions', () => {
        // 'system' is MUI's value; framer's equivalent is <MotionConfig
        // reducedMotion="user">, wired separately in App.tsx.
        expect(broadcastTheme.motion?.reducedMotion).toBe('system');
    });

    it('puts no backdrop-filter on Paper', () => {
        // Every Paper in the app overrides the translucent colour with an opaque
        // one, so the blur was computed on all of them and then covered up.
        const paperRoot = broadcastTheme.components?.MuiPaper?.styleOverrides?.root;
        expect(paperRoot).not.toHaveProperty('backdropFilter');
    });

    it('does not scroll-repaint the body gradient', () => {
        // background-attachment: fixed re-rasterises a viewport-sized gradient on
        // every scroll tick; the gradient belongs on a fixed pseudo-element.
        const body = broadcastTheme.components?.MuiCssBaseline?.styleOverrides as
            { body?: Record<string, unknown> } | undefined;
        expect(body?.body).not.toHaveProperty('backgroundAttachment');
        expect(body?.body).toHaveProperty('&::before');
    });
});
