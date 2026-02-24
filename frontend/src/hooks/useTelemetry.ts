import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {TelemetryPacket} from '../types/telemetry.ts';

type TelemetryCallback = (data: TelemetryPacket) => void;

export const useTelemetry = (onDataReceived: TelemetryCallback) => {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);

    // Store the callback in a ref to ensure the STOMP client always calls the latest version
    // without needing to disconnect/reconnect when the callback function identity changes.
    const callbackRef = useRef(onDataReceived);
    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        // 1. Initialize STOMP Client over SockJS
        const socket = new SockJS('/ws'); // Matches vite.config.ts proxy
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            debug: (str) => console.log('[STOMP]:', str),
            onConnect: () => {
                console.log('🟢 Connected to Telemetry Stream');
                setIsConnected(true);

                // 2. Subscribe to the "Live" Topic
                client.subscribe('/topic/race-data', (message: IMessage) => {
                    try {
                        const payload: TelemetryPacket = JSON.parse(message.body);
                        // 3. Invoke the callback directly (Zero-State Update)
                        if (callbackRef.current) {
                            callbackRef.current(payload);
                        }
                    } catch (err) {
                        console.error('Failed to parse telemetry:', err);
                    }
                });
            },
            onDisconnect: () => {
                console.log('🔴 Disconnected from Telemetry Stream');
                setIsConnected(false);
            },
            onStompError: (frame) => {
                console.error('Broker reported error: ' + frame.headers['message']);
                console.error('Additional details: ' + frame.body);
            },
        });

        // 4. Activate Connection
        client.activate();
        clientRef.current = client;

        // 5. Cleanup on Unmount
        return () => {
            if (client.active) {
                client.deactivate();
            }
        };
    }, []);

    return { isConnected };
};