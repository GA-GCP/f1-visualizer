/**
 * Narrows what `getAccessTokenSilently()` resolves to into a token that can
 * actually be sent.
 *
 * Since @auth0/auth0-react 2.25.0 (auth0-spa-js 2.25.0) the call is typed as
 * resolving to `string | undefined`, which is what the implementation always
 * could do: with `cacheMode: 'cache-only'` and nothing cached it resolves to
 * `undefined` rather than throwing. Nothing here uses cache-only, so a missing
 * token is a failure, not a state — and both consumers already treat a
 * rejected provider as "could not authenticate": apiClient's 401 retry falls
 * through to re-authentication, and stompClient's beforeConnect stops
 * reconnecting. Rejecting here keeps that contract instead of sending
 * `Bearer undefined`.
 */
export async function requireAccessToken(token: Promise<string | undefined>): Promise<string> {
    const value = await token;
    if (!value) {
        throw new Error('Auth0 returned no access token');
    }
    return value;
}
