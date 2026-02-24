import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { LocationPacket } from '../types/telemetry';

type LocationCallback = (data: LocationPacket) => void;

export const useLocation = (onDataReceived: LocationCallback) => {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);

    // Store callback in ref to prevent reconnection loops
    const callbackRef = useRef(onDataReceived);
    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        const socket = new SockJS('/ws');
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            // debug: (str) => console.log('[STOMP Location]:', str), // Uncomment for debugging
            onConnect: () => {
                console.log('🟢 Connected to Location Stream');
                setIsConnected(true);

                // Subscribe to the NEW location topic
                client.subscribe('/topic/race-location', (message: IMessage) => {
                    try {
                        const payload: LocationPacket = JSON.parse(message.body);
                        if (callbackRef.current) {
                            callbackRef.current(payload);
                        }
                    } catch (err) {
                        console.error('Failed to parse location packet:', err);
                    }
                });
            },
            onDisconnect: () => {
                console.log('🔴 Disconnected from Location Stream');
                setIsConnected(false);
            }
        });

        client.activate();
        clientRef.current = client;

        return () => {
            if (client.active) {
                client.deactivate();
            }
        };
    }, []);

    return { isConnected };
};