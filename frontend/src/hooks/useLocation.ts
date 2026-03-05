import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import type { LocationPacket } from '../types/telemetry';

/**
 * Subscribes to the `/topic/race-location` STOMP topic and pushes every
 * incoming {@link LocationPacket} directly into the provided mutable queue.
 *
 * Unlike the telemetry hook (which only needs the *latest* frame), every
 * GPS point matters for drawing the circuit trace, so we push immediately
 * in the STOMP callback — no intermediate rAF buffer needed because the
 * queue is a plain mutable array (not React state), so React 18 batching
 * doesn't apply.
 */
export const useLocation = (locationQueueRef: React.RefObject<LocationPacket[]>) => {
    const [isConnected, setIsConnected] = useState(false);
    const packetCountRef = useRef(0);

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null;

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

                        // ── Diagnostic: validate the parsed payload ──
                        if (typeof payload !== 'object' || payload === null) {
                            console.error('[GPS] Parsed payload is not an object:', typeof payload, payload);
                            return;
                        }
                        if (payload.x === undefined || payload.y === undefined || payload.driver_number === undefined) {
                            console.error('[GPS] Payload missing required fields (x, y, driver_number):', payload);
                            return;
                        }

                        locationQueueRef.current.push(payload);

                        // Log first packet and then every 500th packet
                        packetCountRef.current++;
                        if (packetCountRef.current === 1 || packetCountRef.current % 500 === 0) {
                            console.log(`[GPS] Packet #${packetCountRef.current} | driver=${payload.driver_number} x=${payload.x} y=${payload.y} | queue=${locationQueueRef.current.length}`);
                        }
                    } catch (err) {
                        console.error('[GPS] Failed to parse location packet:', err, 'raw body:', message.body?.substring(0, 200));
                    }
                });

                console.log('[GPS] Subscribed to /topic/race-location');
            } else if (!stompClient.connected && subscription) {
                // Connection dropped — clear the stale reference so we
                // re-subscribe on the next successful connection.
                subscription = null;
                setIsConnected(false);
                console.warn('[GPS] STOMP connection lost, will resubscribe on reconnect');
            }
        }, 500);

        return () => {
            clearInterval(checkConnection);
            if (subscription) subscription.unsubscribe();
        };
    }, [locationQueueRef]);

    return { isConnected };
};
