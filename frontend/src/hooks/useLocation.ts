import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { LocationPacket } from '../types/telemetry';

type LocationCallback = (data: LocationPacket) => void;

export const useLocation = (onDataReceived: LocationCallback) => {
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onDataReceived);

    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        // Wait for the singleton STOMP client to be connected before subscribing
        const checkConnection = setInterval(() => {
            if (stompClient.connected) {
                setIsConnected(true);
                clearInterval(checkConnection);
            }
        }, 500);

        // Subscribe to the spatial data stream
        const subscription = stompClient.subscribe('/topic/race-location', (message: IMessage) => {
            try {
                const payload: LocationPacket = JSON.parse(message.body);
                if (callbackRef.current) {
                    callbackRef.current(payload);
                }
            } catch (err) {
                console.error('Failed to parse location packet:', err);
            }
        });

        // Cleanup: Unsubscribe when the component unmounts
        return () => {
            clearInterval(checkConnection);
            subscription.unsubscribe();
        };
    }, []);

    return { isConnected };
};