import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
 * signature, which is the API's job. So the token has to be built per sign-in
 * with the real nonce echoed back; a fixed fixture token fails on nonce
 * mismatch, and that mismatch is the whole point of the check.
 */
function idToken(domain: string, nonce: string): string {
    const now = Math.floor(Date.now() / 1000);
    return [
        base64url({ alg: 'RS256', typ: 'JWT', kid: 'e2e' }),
        base64url({
            iss: `https://${domain}/`,
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

async function bodyOf(request: IncomingMessage): Promise<URLSearchParams> {
    let raw = '';
    for await (const chunk of request) raw += String(chunk);
    // The SDK posts a form by default and JSON when told to; either way, the
    // code is all this needs.
    if ((request.headers['content-type'] ?? '').includes('json')) {
        return new URLSearchParams(JSON.parse(raw) as Record<string, string>);
    }
    return new URLSearchParams(raw);
}

/**
 * An Auth0 tenant that completes the real redirect handshake, over HTTPS with
 * the certificate made for the run, on 127.0.0.1 alone. Chrome reaches it as
 * https://`domain` (e2e/browser.ts).
 *
 * The app uses cacheLocation="memory", so there is no stored session to seed —
 * a token has to arrive through the flow. That is the better test anyway: this
 * exercises loginWithRedirect, the code/state round trip, PKCE token exchange
 * and onRedirectCallback exactly as production does, and it is the one path
 * that was previously only ever run by real users.
 *
 * Each sign-in's nonce is kept under the code issued for it, so the browsers of
 * tests running at once never trade nonces.
 *
 * Like a tenant's Allowed Callback URLs and Allowed Logout URLs, it redirects
 * only to `app`, the origin the e2e build is served from, and refuses any other
 * redirect_uri or returnTo with a 400. The Location it sends is built from
 * `app`, never copied from the request, so the stand-in cannot be made into an
 * open redirect.
 */
export function auth0StandIn(
    domain: string,
    tls: { cert: string; key: string },
    app: string,
): Server {
    const nonces = new Map<string, string>();
    const refuse = (response: ServerResponse, what: string): void => {
        response.writeHead(400, { 'content-type': 'text/plain' }).end(`${what} is not ${app}`);
    };

    const answer = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        const url = new URL(request.url ?? '/', `https://${domain}`);
        // The token exchange is a cross-origin fetch from the app's origin.
        const cors = {
            'access-control-allow-origin': request.headers.origin ?? '*',
            'access-control-allow-headers':
                request.headers['access-control-request-headers'] ?? '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
        };

        if (request.method === 'OPTIONS') {
            response.writeHead(204, cors).end();
            return;
        }

        if (url.pathname === '/authorize') {
            // What a tenant does after a successful login: bounce back to the
            // app with an authorization code and the state it was given. The
            // app sends its origin as redirect_uri (src/App.tsx).
            if (url.searchParams.get('redirect_uri') !== app) {
                refuse(response, 'redirect_uri');
                return;
            }
            const code = randomBytes(16).toString('hex');
            nonces.set(code, url.searchParams.get('nonce') ?? '');
            const back = new URL(app);
            back.searchParams.set('code', code);
            back.searchParams.set('state', url.searchParams.get('state') ?? '');
            response.writeHead(302, { location: back.href }).end();
            return;
        }

        if (url.pathname === '/oauth/token' && request.method === 'POST') {
            const code = (await bodyOf(request)).get('code') ?? '';
            const nonce = nonces.get(code) ?? '';
            nonces.delete(code);
            response.writeHead(200, { ...cors, 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    access_token: 'e2e-access-token',
                    id_token: idToken(domain, nonce),
                    // The app sets useRefreshTokens with the iframe fallback
                    // off, so a response without this would put it in a state
                    // it never reaches in production.
                    refresh_token: 'e2e-refresh-token',
                    scope: 'openid profile email offline_access',
                    expires_in: 3600,
                    token_type: 'Bearer',
                }),
            );
            return;
        }

        if (url.pathname === '/v2/logout') {
            // The app sends its origin as returnTo (LayoutMain.tsx).
            if (url.searchParams.get('returnTo') !== app) {
                refuse(response, 'returnTo');
                return;
            }
            response.writeHead(302, { location: app }).end();
            return;
        }

        response.writeHead(404, cors).end();
    };

    return createServer({ cert: tls.cert, key: tls.key }, (request, response) => {
        answer(request, response).catch((failure: unknown) => {
            response.writeHead(500).end(String(failure));
        });
    });
}
