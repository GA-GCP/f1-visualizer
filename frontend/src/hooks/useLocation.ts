import { useEffect, useRef, useState } from 'react';
import { type IMessage } from '@stomp/stompjs';
import { stompClient } from '../api/stompClient';
import * as z from 'zod/mini';
import { locationPacketSchema } from '../api/schemas';
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
// Hard cap on queued GPS points.  rAF stops firing in a background tab while the
// WebSocket keeps delivering, so without this the queue grows without bound and
// the first frame after returning drains all of it in one go.  ~20 drivers at
// 4 Hz makes this about a minute of data.
const MAX_QUEUED_POINTS = 5000;

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
                        // Replaces a hand-rolled three-field check that never
                        // verified the types — a string x would sail through it
                        // and land as NaN on the canvas.
                        const result = z.safeParse(locationPacketSchema, JSON.parse(message.body));
                        if (!result.success) {
                            console.error('[GPS] Packet did not match the expected shape', result.error.issues);
                            return;
                        }
                        const payload = result.data;

                        const queue = locationQueueRef.current;
                        queue.push(payload);
                        if (queue.length > MAX_QUEUED_POINTS) {
                            queue.splice(0, queue.length - MAX_QUEUED_POINTS);
                        }

                        // Log first packet and then every 500th packet
                        packetCountRef.current++;
                        if (import.meta.env.DEV && (packetCountRef.current === 1 || packetCountRef.current % 500 === 0)) {
                            console.log(`[GPS] Packet #${packetCountRef.current} | driver=${payload.driver_number} x=${payload.x} y=${payload.y} | queue=${locationQueueRef.current.length}`);
                        }
                    } catch (err) {
                        console.error('[GPS] Failed to parse location packet:', err, 'raw body:', message.body?.substring(0, 200));
                    }
                });

                if (import.meta.env.DEV) console.log('[GPS] Subscribed to /topic/race-location');
            } else if (!stompClient.connected && subscription) {
                // Connection dropped — clear the stale reference so we
                // re-subscribe on the next successful connection.
                subscription = null;
                setIsConnected(false);
                console.warn('[GPS] STOMP connection lost, will resubscribe on reconnect');
            }
        }, 500);

        // Nothing is drawn while the tab is hidden, so keep only the newest point
        // per driver: the queue stays O(drivers) and the first frame back costs
        // one position update per car instead of draining a full cap's worth.
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') return;
            const queue = locationQueueRef.current;
            const latestPerDriver = new Map<number, LocationPacket>();
            for (const point of queue) latestPerDriver.set(point.driver_number, point);
            queue.length = 0;
            queue.push(...latestPerDriver.values());
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(checkConnection);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (subscription) subscription.unsubscribe();
        };
    }, [locationQueueRef]);

    return { isConnected };
};
