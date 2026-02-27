import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {TelemetryPacket} from '../types/telemetry.ts';

type TelemetryCallback = (data: TelemetryPacket) => void;

export const useTelemetry = (onDataReceived: TelemetryCallback) => {
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
            debug: (str) => console.log('[STOMP]:', str),
            onConnect: () => {
                console.log(`🟢 Connected to Telemetry Stream (${import.meta.env.MODE})`);
                setIsConnected(true);

                client.subscribe('/topic/race-data', (message: IMessage) => {
                    try {
                        const payload: TelemetryPacket = JSON.parse(message.body);
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