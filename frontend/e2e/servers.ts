import { execFile } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { preview, type Plugin } from 'vite';
import { AUTH0_DOMAIN, AUTH0_PORT } from './browser';
import { answerApi } from './stand-ins/api';
import { auth0StandIn } from './stand-ins/auth0';
import { telemetryStandIn } from './stand-ins/telemetry';
import type { Server } from 'node:http';
import type { TestProject } from 'vitest/node';

const WEB_PORT = 4173;
const FRONTEND = fileURLToPath(new URL('..', import.meta.url));

declare module 'vitest' {
    export interface ProvidedContext {
        /**
         * The Auth0 stand-in's certificate, made for this run, as Chrome is
         * told to take it: the SHA-256 of its public key, in base64
         * (e2e/browser.ts).
         */
        standInKey: string;
    }
}

/** Whether something listens on 127.0.0.1 at the port, whatever it speaks. */
async function listening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect(port, '127.0.0.1');
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => resolve(false));
    });
}

/**
 * Whether dist/ holds the e2e build: `vite preview` serves whatever is there,
 * so a build from another mode would be tested against a real tenant's name
 * that no stand-in answers for. The e2e build carries .env.e2e's tenant.
 */
async function e2eBuild(): Promise<boolean> {
    const assets = join(FRONTEND, 'dist', 'assets');
    let names: string[];
    try {
        names = await readdir(assets);
    } catch {
        return false;
    }
    for (const name of names.filter((file) => file.endsWith('.js'))) {
        if ((await readFile(join(assets, name), 'utf8')).includes(AUTH0_DOMAIN)) return true;
    }
    return false;
}

/**
 * A certificate for the Auth0 stand-in, made by openssl in `folder` for this
 * run and good for a day: its own key, P-256, for the tenant's name alone,
 * signed by itself and by no authority, so nothing but this run trusts it.
 */
async function certificate(folder: string): Promise<{ cert: string; key: string }> {
    const cert = join(folder, 'auth0.crt');
    const key = join(folder, 'auth0.key');
    await promisify(execFile)('openssl', [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-sha256',
        '-days',
        '1',
        '-subj',
        `/CN=${AUTH0_DOMAIN}`,
        '-addext',
        `subjectAltName=DNS:${AUTH0_DOMAIN}`,
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-keyout',
        key,
        '-out',
        cert,
    ]);
    return { cert: await readFile(cert, 'utf8'), key: await readFile(key, 'utf8') };
}

/** The SHA-256 of the certificate's public key, in base64, as Chrome's SPKI list takes it. */
function spkiHash(pem: string): string {
    const key = new X509Certificate(pem).publicKey;
    return createHash('sha256')
        .update(key.export({ type: 'spki', format: 'der' }))
        .digest('base64');
}

/** The REST API and the STOMP broker, answered on the app's own origin. */
function standIns(): Plugin {
    return {
        name: 'f1v:e2e-stand-ins',
        configurePreviewServer(server) {
            // Before Vite's own middleware, so nothing else answers /api/v1.
            server.middlewares.use((request, response, next) => {
                if (request.url?.startsWith('/api/v1/')) answerApi(request, response);
                else next();
            });
            telemetryStandIn(server.httpServer as Server);
        },
    };
}

/**
 * The browser tests' servers, started once for the run and stopped after it:
 * the e2e build, served by `vite preview` on 127.0.0.1:4173 with the REST API
 * and the STOMP broker answered on the same origin (e2e/stand-ins/api.ts,
 * telemetry.ts); and the Auth0 tenant (e2e/stand-ins/auth0.ts) on
 * 127.0.0.1:4174 over HTTPS, with a certificate made for the run in a folder of
 * its own, removed with the servers.
 *
 * The build is `pnpm build --mode e2e`, made before the run (`pnpm test:e2e`
 * makes it); any other build in dist/ stops the run. So does anything already
 * listening on either port: the tests would meet it instead.
 */
export default async function servers(project: TestProject): Promise<() => Promise<void>> {
    for (const port of [WEB_PORT, AUTH0_PORT]) {
        if (await listening(port))
            throw new Error(`something already listens on 127.0.0.1:${port}`);
    }
    if (!(await e2eBuild())) {
        throw new Error('dist/ is not the e2e build: `pnpm build --mode e2e` makes it');
    }

    const folder = await mkdtemp(join(tmpdir(), 'f1v-e2e-tls-'));
    const stops: (() => Promise<unknown>)[] = [() => rm(folder, { recursive: true, force: true })];
    const stopAll = async () => {
        for (const stop of stops.reverse()) await stop();
    };
    try {
        const tls = await certificate(folder);
        const auth0 = auth0StandIn(AUTH0_DOMAIN, tls, `http://127.0.0.1:${WEB_PORT}`);
        await new Promise<void>((resolve, reject) => {
            auth0.once('error', reject);
            auth0.listen(AUTH0_PORT, '127.0.0.1', resolve);
        });
        stops.push(() => new Promise((resolve) => auth0.close(resolve)));

        const web = await preview({
            root: FRONTEND,
            mode: 'e2e',
            logLevel: 'warn',
            // An empty proxy: preview otherwise takes vite.config.ts's dev
            // server proxy, which would send /ws on to a broker on :8080.
            preview: {
                host: '127.0.0.1',
                port: WEB_PORT,
                strictPort: true,
                open: false,
                proxy: {},
            },
            plugins: [standIns()],
        });
        stops.push(() => web.close());

        project.provide('standInKey', spkiHash(tls.cert));
    } catch (failure) {
        await stopAll();
        throw failure;
    }
    return stopAll;
}
