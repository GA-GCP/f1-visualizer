package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;

class OpenF1DtoSerializationTest {

    private JsonMapper mapper;

    /**
     * Mirrors the exact ObjectMapper configuration used by RedisConfig in both
     * f1v-service-data-ingestion and f1v-service-telemetry.
     *
     * <p>IMPORTANT: This mapper disables {@code MapperFeature.USE_ANNOTATIONS} so that
     * {@code @JsonProperty("n_gear")} on the {@code gear} field does NOT override the
     * naming strategy. Without this, the field serializes as {@code "n_gear"}, breaking
     * the frontend which expects {@code "gear"}. The SNAKE_CASE strategy converts Java
     * field names directly, producing the correct wire format.
     *
     * @see com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig
     * @see com.elysianarts.f1.visualizer.telemetry.config.RedisConfig
     */
    private JsonMapper redisMapper;

    @BeforeEach
    void setUp() {
        mapper = JsonMapper.builder().findAndAddModules().build();
        redisMapper = JsonMapper.builder()
                .disable(MapperFeature.USE_ANNOTATIONS)
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .build();
    }

    @Test
    void carData_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.123Z",
                "driver_number": 1,
                "speed": 310,
                "rpm": 11500,
                "n_gear": 8,
                "throttle": 100,
                "brake": 0,
                "drs": 1
            }
            """;

        OpenF1CarData data = mapper.readValue(json, OpenF1CarData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(1219L, data.getMeetingKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(310, data.getSpeed());
        assertEquals(8, data.getGear());
        assertNotNull(data.getDate());
    }

    @Test
    void locationData_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.456Z",
                "driver_number": 1,
                "x": 1200,
                "y": 3400,
                "z": 100
            }
            """;

        OpenF1LocationData data = mapper.readValue(json, OpenF1LocationData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(1200, data.getX());
        assertEquals(3400, data.getY());
        assertEquals(100, data.getZ());
    }

    @Test
    void lapData_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "meeting_key": 1219,
                "driver_number": 1,
                "lap_number": 5,
                "lap_duration": 92.456,
                "duration_sector_1": 28.123,
                "duration_sector_2": 33.789,
                "duration_sector_3": 30.544
            }
            """;

        OpenF1LapData data = mapper.readValue(json, OpenF1LapData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(5, data.getLapNumber());
        assertEquals(92.456, data.getLapDuration());
        assertEquals(28.123, data.getSector1Duration());
    }

    @Test
    void stintData_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "meeting_key": 1219,
                "stint_number": 2,
                "driver_number": 1,
                "lap_start": 15,
                "lap_end": 30,
                "compound": "MEDIUM",
                "tyre_age_at_start": 0
            }
            """;

        OpenF1StintData data = mapper.readValue(json, OpenF1StintData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(2, data.getStintNumber());
        assertEquals(1, data.getDriverNumber());
        assertEquals(15, data.getLapStart());
        assertEquals(30, data.getLapEnd());
        assertEquals("MEDIUM", data.getCompound());
        assertEquals(0, data.getTyreAgeAtStart());
    }

    @Test
    void positionData_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "driver_number": 1,
                "position": 3
            }
            """;

        OpenF1PositionData data = mapper.readValue(json, OpenF1PositionData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(3, data.getPosition());
    }

    @Test
    void session_DeserializesSnakeCaseJson_Correctly() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "date_start": "2023-09-17T12:00:00.000Z",
                "date_end": "2023-09-17T14:00:00.000Z"
            }
            """;

        OpenF1Session data = mapper.readValue(json, OpenF1Session.class);

        assertEquals(9165L, data.getSessionKey());
        assertNotNull(data.getDateStart());
        assertNotNull(data.getDateEnd());
    }

    @Test
    void carData_RoundTrips_Correctly() throws Exception {
        OpenF1CarData original = new OpenF1CarData();
        original.setSessionKey(9165L);
        original.setDriverNumber(1);
        original.setSpeed(310);
        original.setGear(8);
        original.setThrottle(100);
        original.setBrake(0);

        String json = mapper.writeValueAsString(original);
        OpenF1CarData deserialized = mapper.readValue(json, OpenF1CarData.class);

        assertEquals(original.getSessionKey(), deserialized.getSessionKey());
        assertEquals(original.getDriverNumber(), deserialized.getDriverNumber());
        assertEquals(original.getSpeed(), deserialized.getSpeed());
        assertEquals(original.getGear(), deserialized.getGear());
    }

    @Test
    void carData_HandlesNullFields_WithoutError() throws Exception {
        String json = """
            {
                "session_key": 9165,
                "driver_number": 1
            }
            """;

        OpenF1CarData data = mapper.readValue(json, OpenF1CarData.class);

        assertEquals(9165L, data.getSessionKey());
        assertEquals(1, data.getDriverNumber());
        assertNull(data.getSpeed());
        assertNull(data.getRpm());
        assertNull(data.getGear());
    }

    // ===================================================================
    // Redis Wire-Format Tests
    //
    // These tests validate that the SNAKE_CASE ObjectMapper (used by
    // RedisConfig) produces JSON matching the frontend TypeScript interfaces.
    // ===================================================================

    @Test
    void carData_RedisWireFormat_MatchesFrontendTelemetryPacket() throws Exception {
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

        String json = redisMapper.writeValueAsString(data);
        JsonNode node = redisMapper.readTree(json);

        // Assert snake_case keys matching frontend TelemetryPacket interface
        assertTrue(node.has("session_key"), "Expected 'session_key'");
        assertTrue(node.has("meeting_key"), "Expected 'meeting_key'");
        assertTrue(node.has("date"), "Expected 'date'");
        assertTrue(node.has("driver_number"), "Expected 'driver_number'");
        assertTrue(node.has("speed"), "Expected 'speed'");
        assertTrue(node.has("rpm"), "Expected 'rpm'");
        assertTrue(node.has("gear"), "Expected 'gear'");
        assertTrue(node.has("throttle"), "Expected 'throttle'");
        assertTrue(node.has("brake"), "Expected 'brake'");
        assertTrue(node.has("drs"), "Expected 'drs'");

        // Sentinel: @JsonProperty("n_gear") must NOT be honored — frontend expects "gear"
        assertFalse(node.has("n_gear"), "'n_gear' must not appear; frontend expects 'gear'");

        // No camelCase keys should leak through
        assertFalse(node.has("sessionKey"), "camelCase 'sessionKey' must not appear");
        assertFalse(node.has("meetingKey"), "camelCase 'meetingKey' must not appear");
        assertFalse(node.has("driverNumber"), "camelCase 'driverNumber' must not appear");

        // Verify values
        assertEquals(9165, node.get("session_key").intValue());
        assertEquals(1, node.get("driver_number").intValue());
        assertEquals(310, node.get("speed").intValue());
        assertEquals(8, node.get("gear").intValue());
    }

    @Test
    void locationData_RedisWireFormat_MatchesFrontendLocationPacket() throws Exception {
        OpenF1LocationData data = new OpenF1LocationData();
        data.setSessionKey(9165L);
        data.setMeetingKey(1219L);
        data.setDate(OffsetDateTime.parse("2023-09-17T12:00:00.456Z"));
        data.setDriverNumber(1);
        data.setX(1200);
        data.setY(3400);
        data.setZ(100);

        String json = redisMapper.writeValueAsString(data);
        JsonNode node = redisMapper.readTree(json);

        // Assert snake_case keys matching frontend LocationPacket interface
        assertTrue(node.has("session_key"), "Expected 'session_key'");
        assertTrue(node.has("meeting_key"), "Expected 'meeting_key'");
        assertTrue(node.has("date"), "Expected 'date'");
        assertTrue(node.has("driver_number"), "Expected 'driver_number'");
        assertTrue(node.has("x"), "Expected 'x'");
        assertTrue(node.has("y"), "Expected 'y'");
        assertTrue(node.has("z"), "Expected 'z'");

        // No camelCase keys should leak through
        assertFalse(node.has("sessionKey"), "camelCase 'sessionKey' must not appear");
        assertFalse(node.has("meetingKey"), "camelCase 'meetingKey' must not appear");
        assertFalse(node.has("driverNumber"), "camelCase 'driverNumber' must not appear");

        // Verify values
        assertEquals(9165, node.get("session_key").intValue());
        assertEquals(1, node.get("driver_number").intValue());
        assertEquals(1200, node.get("x").intValue());
        assertEquals(3400, node.get("y").intValue());
        assertEquals(100, node.get("z").intValue());
    }

    @Test
    void carData_RedisWireFormat_RoundTrips_Correctly() throws Exception {
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

        String json = redisMapper.writeValueAsString(original);
        OpenF1CarData deserialized = redisMapper.readValue(json, OpenF1CarData.class);

        assertEquals(original.getSessionKey(), deserialized.getSessionKey());
        assertEquals(original.getMeetingKey(), deserialized.getMeetingKey());
        assertEquals(original.getDriverNumber(), deserialized.getDriverNumber());
        assertEquals(original.getSpeed(), deserialized.getSpeed());
        assertEquals(original.getRpm(), deserialized.getRpm());
        assertEquals(original.getGear(), deserialized.getGear());
        assertEquals(original.getThrottle(), deserialized.getThrottle());
        assertEquals(original.getBrake(), deserialized.getBrake());
        assertEquals(original.getDrs(), deserialized.getDrs());
        assertNotNull(deserialized.getDate());
    }
}
