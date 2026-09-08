import type { Page } from '@playwright/test';

/** STOMP terminates every frame with a NULL octet. */
const NUL = '\0';

/** A closed oval, so the trace draws a recognisable circuit rather than noise. */
export function circuitPath(points = 240): Array<{ x: number; y: number }> {
    return Array.from({ length: points }, (_, i) => {
        const t = (i / points) * Math.PI * 2;
        return { x: Math.cos(t) * 900 + Math.sin(t * 3) * 120, y: Math.sin(t) * 520 };
    });
}

function frame(command: string, headers: Record<string, string>, body = ''): string {
    const head = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
    return `${command}\n${head}\n\n${body}${NUL}`;
}

/** STOMP frames are `COMMAND\nheaders\n\nbody\0`; headers are `key:value`. */
function parse(raw: string): { command: string; headers: Record<string, string> } | null {
    const text = raw.endsWith(NUL) ? raw.slice(0, -1) : raw;
    // A bare newline is a heartbeat, not a frame.
    if (text.trim() === '') return null;

    const [head] = text.split('\n\n');
    const [command, ...headerLines] = head.split('\n');
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
        const index = line.indexOf(':');
        if (index > 0) headers[line.slice(0, index)] = line.slice(index + 1);
    }
    return { command, headers };
}

export interface TelemetryOptions {
    /** Points to replay on /topic/race-location. */
    path?: Array<{ x: number; y: number }>;
    sessionKey?: number;
    driverNumber?: number;
}

/**
 * A STOMP broker, mocked at the socket.
 *
 * The audit suggested a separate Node `ws` fixture process plus a VITE_STOMP_URL
 * override. routeWebSocket does the same job without either: no second server to
 * start and tear down, and no production env var that exists only for tests —
 * the app connects to exactly the URL it derives in production.
 *
 * Deliberately speaks real STOMP rather than stubbing @stomp/stompjs, because
 * the frame handling — CONNECT/CONNECTED negotiation, the Authorization header
 * carried on CONNECT, subscription ids — is part of what has only ever run in
 * production.
 */
export async function stubTelemetry(page: Page, options: TelemetryOptions = {}): Promise<void> {
    const { path = circuitPath(), sessionKey = 9001, driverNumber = 1 } = options;

    await page.routeWebSocket(/\/ws\/websocket$/, ws => {
        // destination -> subscription id
        const subscriptions = new Map<string, string>();
        let messageId = 0;
        let timer: ReturnType<typeof setInterval> | undefined;
        let index = 0;

        const send = (destination: string, payload: unknown) => {
            const id = subscriptions.get(destination);
            if (!id) return;
            ws.send(frame('MESSAGE', {
                destination,
                subscription: id,
                'message-id': String(++messageId),
                'content-type': 'application/json',
            }, JSON.stringify(payload)));
        };

        ws.onMessage(raw => {
            const parsed = parse(String(raw));
            if (!parsed) return;

            if (parsed.command === 'CONNECT' || parsed.command === 'STOMP') {
                // 0,0 disables heartbeats in both directions. The client asks
                // for 10s out / 15s in; agreeing to none keeps the fixture from
                // running a ticker, and the client accepts that per the spec.
                ws.send(frame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
                return;
            }

            if (parsed.command === 'SUBSCRIBE') {
                const destination = parsed.headers.destination;
                subscriptions.set(destination, parsed.headers.id ?? `sub-${subscriptions.size}`);

                if (destination === '/topic/race-location' && !timer) {
                    // ~40 Hz: fast enough that the trace is drawn well within a
                    // test's patience, slow enough to stay a stream rather than
                    // one burst the rAF flush collapses into a single frame.
                    timer = setInterval(() => {
                        const point = path[index % path.length];
                        index++;
                        send('/topic/race-location', {
                            session_key: sessionKey, meeting_key: 1234,
                            date: new Date().toISOString(),
                            driver_number: driverNumber,
                            x: point.x, y: point.y, z: 0,
                        });
                        send('/topic/race-data', {
                            session_key: sessionKey, meeting_key: 1234,
                            date: new Date().toISOString(),
                            driver_number: driverNumber,
                            speed: 280 + (index % 40), rpm: 11000, gear: 7,
                            throttle: 100, brake: 0, drs: 1,
                        });
                    }, 25);
                }
                return;
            }

            if (parsed.command === 'UNSUBSCRIBE' || parsed.command === 'DISCONNECT') {
                clearInterval(timer);
                timer = undefined;
            }
        });

        ws.onClose(() => clearInterval(timer));
    });
}
