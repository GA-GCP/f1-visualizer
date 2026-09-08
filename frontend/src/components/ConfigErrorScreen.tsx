import React from 'react';

/**
 * Shown when required environment variables are missing.
 *
 * The app previously rendered `null` in this case, so a typo in an env key
 * produced a blank page with nothing in the console to explain it — and for
 * Auth0 specifically, a confusing redirect rather than a config error.
 *
 * Deliberately plain markup: this has to render before the theme, the router
 * and the auth provider, none of which can be trusted when config is broken.
 */
const ConfigErrorScreen: React.FC<{ missing: readonly string[] }> = ({ missing }) => (
    <div
        role="alert"
        style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            background: '#101010',
            color: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
        }}
    >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Configuration error</h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)' }}>
            This build is missing required environment{' '}
            {missing.length === 1 ? 'variable' : 'variables'}:
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontFamily: 'monospace' }}>
            {missing.map((name) => (
                <li key={name}>{name}</li>
            ))}
        </ul>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
            See <code>.env.example</code> for the full contract.
        </p>
    </div>
);

export default ConfigErrorScreen;
