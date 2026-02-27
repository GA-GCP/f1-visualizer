import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { TelemetryPacket } from '../types/telemetry';

export const useTelemetry = (onDataReceived: (data: TelemetryPacket) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);

    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        // Wait for the STOMP client to be connected before subscribing
        const checkConnection = setInterval(() => {
            if (stompClient.connected) {
                setIsConnected(true);
                clearInterval(checkConnection);
            }
        }, 500);

        const subscription = stompClient.subscribe('/topic/race-data', (message: IMessage) => {
            try {
                const payload: TelemetryPacket = JSON.parse(message.body);
                if (callbackRef.current) callbackRef.current(payload);
            } catch (err) {
                console.error('Failed to parse telemetry:', err);
            }
        });

        return () => {
            clearInterval(checkConnection);
            subscription.unsubscribe();
        };
    }, []);

    return { isConnected };
};