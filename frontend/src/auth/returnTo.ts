/** Where a user without a deep link lands after signing in. */
export const DEFAULT_RETURN_TO = '/dashboard';

/**
 * Narrows a post-login destination to a same-origin path.
 *
 * `returnTo` reaches `navigate()` from Auth0's appState. auth0-spa-js keeps
 * that in its own transaction store keyed by the `state` parameter, so a remote
 * attacker cannot set it without already having script execution — the
 * exploitable case is not today's. It is the moment someone wires deep-link
 * preservation and starts putting a URL in there, which is exactly what the
 * commit adding this does.
 *
 * Rejected: anything that is not a single-slash-prefixed path. That covers
 * absolute URLs (`https://evil.test`), protocol-relative ones (`//evil.test`,
 * which `startsWith('/')` alone would let through), and backslash variants that
 * some parsers normalise to a scheme-relative URL.
 */
export function safeReturnTo(returnTo: string | undefined | null): string {
    if (typeof returnTo !== 'string' || returnTo.length === 0) return DEFAULT_RETURN_TO;
    if (!returnTo.startsWith('/')) return DEFAULT_RETURN_TO;
    if (returnTo.startsWith('//') || returnTo.startsWith('/\\')) return DEFAULT_RETURN_TO;
    return returnTo;
}
