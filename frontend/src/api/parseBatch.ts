import * as z from 'zod/mini';

/**
 * Parses one STOMP message body into the packets it carries.
 *
 * The replay engine publishes a whole tick's worth of packets as a single JSON
 * array on each channel, rather than one message per packet — roughly 100x fewer
 * Redis commands and WebSocket frames for exactly the same data, since this
 * client already buffers and flushes once per animation frame (P1).
 *
 * A bare object is still accepted: during a rolling deploy the old per-packet
 * producer and the new consumer overlap, and one shape should not blank the feed
 * for the duration.
 *
 * Malformed entries are dropped individually — one bad packet must not discard
 * the other nineteen drivers in the same tick, nor tear down the subscription.
 */
export const parsePacketBatch = <T>(
    schema: z.ZodMiniType<T>,
    body: string,
    onInvalid: (issues: unknown) => void,
): T[] => {
    const parsed: unknown = JSON.parse(body);
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

    const packets: T[] = [];
    for (const candidate of candidates) {
        const result = z.safeParse(schema, candidate);
        if (result.success) {
            packets.push(result.data);
        } else {
            onInvalid(result.error.issues);
        }
    }
    return packets;
};
