/**
 * Ensures at most one interactive login is started per page load.
 *
 * A page load issues several requests in parallel; when the session has expired
 * they all fail together, and without this each would call loginWithRedirect.
 * The flag is never cleared at runtime — once a redirect is in flight the page
 * is navigating away, and nothing else should start another one.
 */
let redirectingToLogin = false;

/** Returns true the first time only; subsequent calls are no-ops. */
export function claimLoginRedirect(): boolean {
    if (redirectingToLogin) return false;
    redirectingToLogin = true;
    return true;
}

/** Test-only: the guard is deliberately never reset at runtime. */
export function resetLoginRedirectGuard(): void {
    redirectingToLogin = false;
}
