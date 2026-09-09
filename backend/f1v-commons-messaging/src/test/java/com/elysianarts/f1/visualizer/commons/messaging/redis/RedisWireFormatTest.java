package com.elysianarts.f1.visualizer.commons.messaging.redis;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The contract between the packet producer and the browser.
 *
 * <p>These assertions used to live two modules away from the configuration they
 * protect, against a hand-copied mirror of it that was free to drift. They now
 * run against {@link RedisMessagingConfig#redisObjectMapper()} itself, beside the
 * single definition of that mapper (C5, C1). The interface has broken twice
 * (#36, #43).</p>
 */
class RedisWireFormatTest {

    private final ObjectMapper redisMapper = RedisMessagingConfig.redisObjectMapper();

    @Test
    void carData_MatchesFrontendTelemetryPacket() {
        OpenF1CarData data = new OpenF1CarData();
        data.setSessionKey(9165L);
        data.setMeetingKey(1219L);
        data.setDate(OffsetDateTime.parse("2023-09-17T12:00:00.123Z"));
        data.setDriverNumber(1);
        data.setSpeed(310);
        data.setRpm(11500);
        data.setGear(8);
        data.setThrottle(100);
        data.setBrake(0);
        data.setDrs(1);

        JsonNode node = redisMapper.readTree(redisMapper.writeValueAsString(data));

        for (String key : new String[]{"session_key", "meeting_key", "date", "driver_number",
                                       "speed", "rpm", "gear", "throttle", "brake", "drs"}) {
            assertTrue(node.has(key), "Expected '" + key + "'");
        }

        // Sentinel: OpenF1's inbound name must not reach the browser, which expects "gear".
        assertFalse(node.has("n_gear"), "'n_gear' must not appear; frontend expects 'gear'");

        assertFalse(node.has("sessionKey"), "camelCase 'sessionKey' must not appear");
        assertFalse(node.has("meetingKey"), "camelCase 'meetingKey' must not appear");
        assertFalse(node.has("driverNumber"), "camelCase 'driverNumber' must not appear");

        assertEquals(9165, node.get("session_key").intValue());
        assertEquals(1, node.get("driver_number").intValue());
        assertEquals(310, node.get("speed").intValue());
        assertEquals(8, node.get("gear").intValue());
    }

    @Test
    void locationData_MatchesFrontendLocationPacket() {
        OpenF1LocationData data = new OpenF1LocationData();
        data.setSessionKey(9165L);
        data.setMeetingKey(1219L);
        data.setDate(OffsetDateTime.parse("2023-09-17T12:00:00.456Z"));
        data.setDriverNumber(1);
        data.setX(1200);
        data.setY(3400);
        data.setZ(100);

        JsonNode node = redisMapper.readTree(redisMapper.writeValueAsString(data));

        for (String key : new String[]{"session_key", "meeting_key", "date", "driver_number", "x", "y", "z"}) {
            assertTrue(node.has(key), "Expected '" + key + "'");
        }
        assertFalse(node.has("sessionKey"), "camelCase 'sessionKey' must not appear");
        assertFalse(node.has("meetingKey"), "camelCase 'meetingKey' must not appear");
        assertFalse(node.has("driverNumber"), "camelCase 'driverNumber' must not appear");

        assertEquals(1200, node.get("x").intValue());
        assertEquals(3400, node.get("y").intValue());
        assertEquals(100, node.get("z").intValue());
    }

    /** The same mapper reads what OpenF1's MQTT feed sends, where the field is "n_gear". */
    @Test
    void carData_StillReadsOpenF1InboundNaming() {
        OpenF1CarData data = redisMapper.readValue(
                "{\"session_key\":9165,\"driver_number\":1,\"speed\":310,\"n_gear\":8}", OpenF1CarData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(8, data.getGear());
    }

    @Test
    void carData_RoundTrips() {
        OpenF1CarData original = new OpenF1CarData();
        original.setSessionKey(9165L);
        original.setMeetingKey(1219L);
        original.setDate(OffsetDateTime.parse("2023-09-17T12:00:00.123Z"));
        original.setDriverNumber(1);
        original.setSpeed(310);
        original.setRpm(11500);
        original.setGear(8);
        original.setThrottle(100);
        original.setBrake(0);
        original.setDrs(1);

        OpenF1CarData deserialized =
                redisMapper.readValue(redisMapper.writeValueAsString(original), OpenF1CarData.class);

        assertEquals(original, deserialized);
    }
}
