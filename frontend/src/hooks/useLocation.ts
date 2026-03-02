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

        // Defer subscription until the STOMP client is actually connected.
        // Without this guard, stompClient.subscribe() throws a synchronous
        // "There is no underlying STOMP connection" TypeError on mount because
        // the SockJS handshake (started by StompAuthHandler) is still in-flight.
        const checkConnection = setInterval(() => {
            if (stompClient.connected) {
                setIsConnected(true);
                clearInterval(checkConnection);

                subscription = stompClient.subscribe('/topic/race-location', (message: IMessage) => {
                    try {
                        const payload: LocationPacket = JSON.parse(message.body);
                        bufferRef.current.push(payload); // Push silently
                    } catch (err) {
                        console.error('Failed to parse location packet:', err);
                    }
                });
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