import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { TelemetryPacket } from '../types/telemetry';

export const useTelemetry = (onDataReceived: (data: TelemetryPacket) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);
    // Keyed by driver_number: 'latest frame' is a per-driver notion, and this
    // also bounds the buffer to one entry per driver no matter how long the
    // tab stays hidden with rAF paused and the socket still delivering.
    const bufferRef = useRef<Map<number, TelemetryPacket>>(new Map());

    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null;
        let animationFrameId: number;

        // Poll for STOMP connectivity and (re-)subscribe when the connection
        // comes back up.  The interval is NOT cleared after the first
        // subscription so that after a disconnect/reconnect cycle (e.g. LB
        // timeout, Cloud Run cold-start) we detect the restored connection
        // and re-create the subscription that was lost with the old socket.
        const checkConnection = setInterval(() => {
            if (stompClient.connected && !subscription) {
                setIsConnected(true);

                subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => {
                    try {
                        const payload: TelemetryPacket = JSON.parse(message.body);
                        bufferRef.current.set(payload.driver_number, payload);
                    } catch (err) {
                        console.error('Failed to parse telemetry:', err);
                    }
                });
            } else if (!stompClient.connected && subscription) {
                // Connection dropped — clear the stale reference so we
                // re-subscribe on the next successful connection.
                subscription = null;
                setIsConnected(false);
            }
        }, 500);

        // 60fps flush loop (safe to start immediately — buffer is just empty until data arrives)
        const flushBuffer = () => {
            const buffer = bufferRef.current;
            if (buffer.size > 0 && callbackRef.current) {
                // /topic/race-data carries every driver, and the replay engine
                // publishes a whole 250 ms window back-to-back — so all ~20
                // drivers land inside a single rAF interval.  Taking only the
                // last *message* therefore forwarded one arbitrary driver and
                // discarded the rest, which is why the selected driver's readout
                // stalled while the trace kept moving.  Forward the latest packet
                // for each driver instead; the consumer filters to the one it wants.
                for (const packet of buffer.values()) {
                    callbackRef.current(packet);
                }
                buffer.clear();
            }
            animationFrameId = requestAnimationFrame(flushBuffer);
        };
        flushBuffer();

        return () => {
            clearInterval(checkConnection);
            if (subscription) subscription.unsubscribe();
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return { isConnected };
};