import type { Page } from '@playwright/test';

export const AUTH0_DOMAIN = 'auth.e2e.test';
export const AUTH0_CLIENT_ID = 'e2e-client-id';
export const E2E_SUB = 'auth0|e2e-user';
export const E2E_EMAIL = 'e2e@example.test';

function base64url(value: object | string): string {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return Buffer.from(json).toString('base64url');
}

/**
 * An id_token the SDK will accept.
 *
 * @auth0/auth0-spa-js validates the *claims* — iss, aud, exp, iat, sub and
 * crucially the nonce it generated for this transaction — but not the
 * signature, which is the API's job. So the token has to be built per-request
 * with the real nonce echoed back; a fixed fixture token fails on nonce
 * mismatch, and that mismatch is the whole point of the check.
 */
function idToken(nonce: string): string {
    const now = Math.floor(Date.now() / 1000);
    return [
        base64url({ alg: 'RS256', typ: 'JWT', kid: 'e2e' }),
        base64url({
            iss: `https://${AUTH0_DOMAIN}/`,
            aud: AUTH0_CLIENT_ID,
            sub: E2E_SUB,
            nonce,
            iat: now,
            exp: now + 3600,
            email: E2E_EMAIL,
            email_verified: true,
            name: 'E2E Driver',
            nickname: 'e2e',
        }),
        base64url('signature-not-verified-by-the-client'),
    ].join('.');
}

/**
 * Completes the real Auth0 redirect handshake without a tenant.
 *
 * The app uses cacheLocation="memory", so there is no storageState to seed —
 * a token has to arrive through the flow. That is the better test anyway: this
 * exercises loginWithRedirect, the code/state round trip, PKCE token exchange
 * and onRedirectCallback exactly as production does, and it is the one path
 * that was previously only ever run by real users.
 */
export async function stubAuth0(page: Page): Promise<void> {
    // Captured from /authorize and replayed into the token response.
    let nonce = '';

    await page.route(`https://${AUTH0_DOMAIN}/authorize*`, async route => {
        const url = new URL(route.request().url());
        nonce = url.searchParams.get('nonce') ?? '';
        const state = url.searchParams.get('state') ?? '';
        const redirectUri = url.searchParams.get('redirect_uri') ?? '';

        // What a tenant does after a successful login: bounce back to the app
        // with an authorization code and the state it was given.
        await route.fulfill({
            status: 302,
            headers: {
                location: `${redirectUri}?code=e2e-authorization-code&state=${encodeURIComponent(state)}`,
            },
            body: '',
        });
    });

    await page.route(`https://${AUTH0_DOMAIN}/oauth/token`, async route => {
        await route.fulfill({
            json: {
                access_token: 'e2e-access-token',
                id_token: idToken(nonce),
                // The app sets useRefreshTokens with the iframe fallback off,
                // so a response without this would put it in a state it never
                // reaches in production.
                refresh_token: 'e2e-refresh-token',
                scope: 'openid profile email offline_access',
                expires_in: 3600,
                token_type: 'Bearer',
            },
        });
    });

    // Logout would otherwise navigate to a domain that does not resolve.
    await page.route(`https://${AUTH0_DOMAIN}/v2/logout*`, async route => {
        const returnTo = new URL(route.request().url()).searchParams.get('returnTo') ?? '/';
        await route.fulfill({ status: 302, headers: { location: returnTo }, body: '' });
    });
}
