import { useEffect, useRef } from 'react';
import { type IMessage } from '@stomp/stompjs';
import * as z from 'zod/mini';
import { stompClient } from '../api/stompClient';
import { telemetryPacketSchema } from '../api/schemas';
import { useConnectionStatus } from '../realtime/useConnectionStatus';
import { createLogger } from '../lib/logger';
import type { TelemetryPacket } from '../types/telemetry';

const log = createLogger('telemetry');

export const useTelemetry = (onDataReceived: (data: TelemetryPacket) => void) => {
    const status = useConnectionStatus();
    const isConnected = status === 'connected';

    const callbackRef = useRef(onDataReceived);
    // Keyed by driver_number: 'latest frame' is a per-driver notion, and this
    // also bounds the buffer to one entry per driver no matter how long the
    // tab stays hidden with rAF paused and the socket still delivering.
    const bufferRef = useRef<Map<number, TelemetryPacket>>(new Map());

    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    // Subscribe whenever the client reports a live connection.
    //
    // This used to be a 500 ms interval polling `stompClient.connected`, which
    // meant up to half a second of dropped data after every reconnect and a
    // timer running for the lifetime of the page. The client publishes its own
    // state now, so a reconnect re-runs this effect directly.
    useEffect(() => {
        if (!isConnected) return;

        const subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => {
            try {
                // safeParse, not parse: one malformed packet must not tear down
                // the subscription for the rest of the feed.
                const result = z.safeParse(telemetryPacketSchema, JSON.parse(message.body));
                if (!result.success) {
                    log.error('Packet did not match the expected shape', result.error.issues);
                    return;
                }
                bufferRef.current.set(result.data.driver_number, result.data);
            } catch (err) {
                log.error('Failed to parse telemetry', err);
            }
        });

        return () => subscription.unsubscribe();
    }, [isConnected]);

    // 60fps flush loop (safe to start immediately — buffer is just empty until data arrives)
    useEffect(() => {
        let animationFrameId: number;

        const flushBuffer = () => {
            const buffer = bufferRef.current;
            if (buffer.size > 0 && callbackRef.current) {
                // /topic/race-data carries every driver, and the replay engine
                // publishes a whole 250 ms window back-to-back — so all ~20
                // drivers land inside a single rAF interval. Taking only the
                // last *message* therefore forwarded one arbitrary driver and
                // discarded the rest, which is why the selected driver's readout
                // stalled while the trace kept moving. Forward the latest packet
                // for each driver instead; the consumer filters to the one it wants.
                for (const packet of buffer.values()) {
                    callbackRef.current(packet);
                }
                buffer.clear();
            }
            animationFrameId = requestAnimationFrame(flushBuffer);
        };
        flushBuffer();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return { isConnected };
};
