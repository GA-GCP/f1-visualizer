/// <reference types="vite/client" />

/**
 * Without this augmentation `import.meta.env.VITE_ANYTHING` resolves through
 * vite/client's index signature and is typed `any` — so a typo such as
 * `VITE_AUTH0_DOMIAN` compiled cleanly and produced `undefined` at runtime,
 * which for Auth0 surfaces as a confusing redirect rather than a config error.
 */
interface ImportMetaEnv {
    readonly VITE_AUTH0_DOMAIN: string;
    readonly VITE_AUTH0_CLIENT_ID: string;
    readonly VITE_AUTH0_AUDIENCE: string;
    /** Full API base, e.g. https://dev.api.f1visualizer.com/api/v1 */
    readonly VITE_API_BASE_URL: string;
    /** Optional: enables STOMP frame logging outside DEV. */
    readonly VITE_STOMP_DEBUG?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
