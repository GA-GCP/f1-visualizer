import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { TelemetryPacket } from '../types/telemetry';

export const useTelemetry = (onDataReceived: (data: TelemetryPacket) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);
    const bufferRef = useRef<TelemetryPacket[]>([]);

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
                        bufferRef.current.push(payload);
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
            if (bufferRef.current.length > 0 && callbackRef.current) {
                // For UI state, we only need the absolute latest frame from the buffer
                const latestPacket = bufferRef.current[bufferRef.current.length - 1];
                callbackRef.current(latestPacket);
                bufferRef.current = []; // Clear buffer after flush
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