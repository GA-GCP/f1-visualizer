import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { LocationPacket } from '../types/telemetry';

type LocationCallback = (data: LocationPacket) => void;

export const useLocation = (onDataReceived: LocationCallback) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);
    // NEW: Buffer for spatial data
    const bufferRef = useRef<LocationPacket[]>([]);

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

                subscription = stompClient.subscribe('/topic/race-location', (message: IMessage) => {
                    try {
                        const payload: LocationPacket = JSON.parse(message.body);
                        bufferRef.current.push(payload);
                    } catch (err) {
                        console.error('Failed to parse location packet:', err);
                    }
                });
            } else if (!stompClient.connected && subscription) {
                // Connection dropped — clear the stale reference so we
                // re-subscribe on the next successful connection.
                subscription = null;
                setIsConnected(false);
            }
        }, 500);

        // Flush all buffered spatial points to the Canvas trace
        const flushBuffer = () => {
            if (bufferRef.current.length > 0 && callbackRef.current) {
                // Unlike Telemetry (where we only need the latest speed),
                // for the track trace, we need to send ALL intermediate points
                // so the line doesn't skip segments.
                bufferRef.current.forEach(packet => callbackRef.current(packet));
                bufferRef.current = [];
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