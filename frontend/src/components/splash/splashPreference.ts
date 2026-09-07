const SKIP_KEY = 'f1v:skip-splash';

/**
 * Whether the user has previously skipped the splash.
 *
 * Wrapped because storage access itself throws in some contexts (Safari private
 * browsing, site data blocked), not just returns null.
 */
export function isSplashSkipRemembered(): boolean {
    try {
        return localStorage.getItem(SKIP_KEY) === '1';
    } catch {
        return false;
    }
}

export function rememberSplashSkip(): void {
    try {
        localStorage.setItem(SKIP_KEY, '1');
    } catch {
        // Nothing to do: the skip still applies to this session.
    }
}

/** Test seam, and the undo for a user who wants the intro back. */
export function forgetSplashSkip(): void {
    try {
        localStorage.removeItem(SKIP_KEY);
    } catch {
        // ignore
    }
}
