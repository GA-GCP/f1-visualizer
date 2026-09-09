import { type IMessage } from '@stomp/stompjs';
import { useEffect, useRef } from 'react';
import { parsePacketBatch } from '../api/parseBatch';
import { telemetryPacketSchema } from '../api/schemas';
import { stompClient } from '../api/stompClient';
import { createLogger } from '../lib/logger';
import { createFrameMonitor, MARK, mark, measureBetween } from '../lib/perf';
import { useConnectionStatus } from '../realtime/useConnectionStatus';
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

        // Time-to-first-packet is per subscription, not per page: a reconnect
        // re-runs this effect, and how quickly the feed resumes after one is
        // exactly as interesting as how quickly it started.
        let sawFirstPacket = false;

        const subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => {
            if (!sawFirstPacket) {
                sawFirstPacket = true;
                mark(MARK.firstPacket);
                measureBetween('f1v:stomp-ttfp', MARK.stompConnected, MARK.firstPacket);
            }
            try {
                // One message now carries a whole tick's packets (P1). Each is
                // validated on its own, so a single malformed entry does not
                // discard the rest of the batch or tear down the subscription.
                for (const packet of parsePacketBatch(
                    telemetryPacketSchema,
                    message.body,
                    (issues) => log.error('Packet did not match the expected shape', issues),
                )) {
                    bufferRef.current.set(packet.driver_number, packet);
                }
            } catch (err) {
                log.error('Failed to parse telemetry', err);
            }
        });

        return () => subscription.unsubscribe();
    }, [isConnected]);

    // 60fps flush loop (safe to start immediately — buffer is just empty until data arrives)
    useEffect(() => {
        let animationFrameId: number;
        // The trace holding 60 fps is the app's core value, and regressions in
        // it were previously found by users rather than by us.
        const frames = createFrameMonitor();

        const flushBuffer = (now: number = performance.now()) => {
            frames.frame(now);
            const buffer = bufferRef.current;
            if (buffer.size > 0 && callbackRef.current) {
                // /topic/race-data carries every driver, and a single message
                // carries a whole 250 ms window — so all ~20 drivers land inside
                // one rAF interval. Taking only the last *message* therefore
                // forwarded one arbitrary driver and discarded the rest, which is
                // why the selected driver's readout stalled while the trace kept
                // moving. Forward the latest packet for each driver instead; the
                // consumer filters to the one it wants.
                for (const packet of buffer.values()) {
                    callbackRef.current(packet);
                }
                buffer.clear();
            }
            animationFrameId = requestAnimationFrame(flushBuffer);
        };
        flushBuffer();

        return () => {
            cancelAnimationFrame(animationFrameId);
            // Report the partial window rather than discarding it: a session
            // that ends after 40 seconds is still evidence about frame health.
            frames.flush(performance.now());
        };
    }, []);

    return { isConnected };
};
