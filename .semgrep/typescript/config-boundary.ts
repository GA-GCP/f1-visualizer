declare const localStorage: Storage;
declare const sessionStorage: Storage;
declare function getAccessTokenSilently(): Promise<string>;

// ruleid: f1v-auth-config-outside-env-module
const domain = import.meta.env.VITE_AUTH0_DOMAIN;

// ruleid: f1v-auth-config-outside-env-module
const base = import.meta.env.VITE_API_BASE_URL;

// ok: f1v-auth-config-outside-env-module
const rum = import.meta.env.VITE_RUM_ENDPOINT;

// ok: f1v-auth-config-outside-env-module
const isDev = import.meta.env.DEV;

export async function persist(): Promise<void> {
    const accessToken = await getAccessTokenSilently();

    // ruleid: f1v-no-token-in-web-storage
    localStorage.setItem('f1v:accessToken', accessToken);

    // ruleid: f1v-no-token-in-web-storage
    sessionStorage.setItem('f1v:x', accessToken);

    // ok: f1v-no-token-in-web-storage
    sessionStorage.setItem('f1v:post-login', '1');

    // ok: f1v-no-token-in-web-storage
    localStorage.setItem('f1v:skip-splash', '1');
}
