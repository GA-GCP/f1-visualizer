import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let wsUrl = 'http://localhost:8080/ws';
if (import.meta.env.MODE === 'prod') {
    wsUrl = 'https://api.f1visualizer.com/ws';
} else if (import.meta.env.MODE === 'uat') {
    wsUrl = 'https://uat.api.f1visualizer.com/ws';
} else if (import.meta.env.MODE === 'dev') {
    wsUrl = 'https://dev.api.f1visualizer.com/ws';
}

export const stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000, // Wait for heartbeat every 10s
    heartbeatOutgoing: 10000, // Send heartbeat every 10s
    debug: (str) => console.log('[STOMP]:', str),
    onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
    },
});

// Activate the singleton immediately
stompClient.activate();