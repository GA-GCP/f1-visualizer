import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { LocationPacket } from '../types/telemetry';

type LocationCallback = (data: LocationPacket) => void;

export const useLocation = (onDataReceived: LocationCallback) => {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);

    const callbackRef = useRef(onDataReceived);
    useEffect(() => {
        callbackRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        // Dynamically determine WebSocket URL based on environment
        let wsUrl = 'http://localhost:8080/ws'; // Default for local 'development'

        if (import.meta.env.MODE === 'prod') {
            wsUrl = 'https://api.f1visualizer.com/ws';
        } else if (import.meta.env.MODE === 'uat') {
            wsUrl = 'https://uat.api.f1visualizer.com/ws';
        } else if (import.meta.env.MODE === 'dev') {
            wsUrl = 'https://dev.api.f1visualizer.com/ws';
        }

        const socket = new SockJS(wsUrl);
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            onConnect: () => {
                console.log(`🟢 Connected to Location Stream (${import.meta.env.MODE})`);
                setIsConnected(true);

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