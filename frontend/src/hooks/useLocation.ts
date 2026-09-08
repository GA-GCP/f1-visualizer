import { type IMessage } from '@stomp/stompjs';
import { useEffect, useRef } from 'react';
import * as z from 'zod/mini';
import { locationPacketSchema } from '../api/schemas';
import { stompClient } from '../api/stompClient';
import { createLogger } from '../lib/logger';
import { useConnectionStatus } from '../realtime/useConnectionStatus';
import type { LocationPacket } from '../types/telemetry';

const log = createLogger('gps');

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
    const status = useConnectionStatus();
    const isConnected = status === 'connected';
    const packetCountRef = useRef(0);

    // Driven by the client's own connection state rather than a 500 ms poller.
    useEffect(() => {
        if (!isConnected) return;

        const subscription = stompClient.subscribe('/topic/race-location', (message: IMessage) => {
            try {
                // Replaces a hand-rolled three-field check that never verified
                // the types — a string x would sail through it and land as NaN
                // on the canvas.
                const result = z.safeParse(locationPacketSchema, JSON.parse(message.body));
                if (!result.success) {
                    log.error('Packet did not match the expected shape', result.error.issues);
                    return;
                }

                const queue = locationQueueRef.current;
                queue.push(result.data);
                if (queue.length > MAX_QUEUED_POINTS) {
                    queue.splice(0, queue.length - MAX_QUEUED_POINTS);
                }

                packetCountRef.current++;
                if (packetCountRef.current === 1 || packetCountRef.current % 500 === 0) {
                    log.debug(
                        `Packet #${packetCountRef.current} | driver=${result.data.driver_number} ` +
                            `x=${result.data.x} y=${result.data.y} | queue=${queue.length}`,
                    );
                }
            } catch (err) {
                log.error('Failed to parse location packet', err, message.body?.substring(0, 200));
            }
        });

        log.debug('Subscribed to /topic/race-location');
        return () => subscription.unsubscribe();
    }, [isConnected, locationQueueRef]);

    // Nothing is drawn while the tab is hidden, so keep only the newest point
    // per driver: the queue stays O(drivers) and the first frame back costs
    // one position update per car instead of draining a full cap's worth.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') return;
            const queue = locationQueueRef.current;
            const latestPerDriver = new Map<number, LocationPacket>();
            for (const point of queue) latestPerDriver.set(point.driver_number, point);
            queue.length = 0;
            queue.push(...latestPerDriver.values());
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [locationQueueRef]);

    return { isConnected };
};
