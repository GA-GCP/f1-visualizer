import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { TelemetryPacket } from '../types/telemetry';

export const useTelemetry = (onDataReceived: (data: TelemetryPacket) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);
    // NEW: Buffer to hold incoming packets without triggering re-renders
    const bufferRef = useRef<TelemetryPacket[]>([]);

    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        const checkConnection = setInterval(() => {
            if (stompClient.connected) {
                setIsConnected(true);
                clearInterval(checkConnection);
            }
        }, 500);

        const subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => {
            try {
                const payload: TelemetryPacket = JSON.parse(message.body);
                bufferRef.current.push(payload); // Push silently
            } catch (err) {
                console.error('Failed to parse telemetry:', err);
            }
        });

        // NEW: 60fps flush loop
        let animationFrameId: number;
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
            subscription.unsubscribe();
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return { isConnected };
};