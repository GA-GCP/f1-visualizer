package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.*;

class OpenF1DtoSerializationTest {

    private JsonMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = JsonMapper.builder().findAndAddModules().build();
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
}
