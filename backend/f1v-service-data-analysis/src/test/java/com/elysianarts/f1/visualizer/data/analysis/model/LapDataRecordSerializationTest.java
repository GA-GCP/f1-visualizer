package com.elysianarts.f1.visualizer.data.analysis.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.*;

class LapDataRecordSerializationTest {

    private JsonMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = JsonMapper.builder().findAndAddModules().build();
    }

    @Test
    void lapDataRecord_SerializesAllFields_Correctly() throws Exception {
        LapDataRecord record = LapDataRecord.builder()
                .driverNumber(1)
                .lapNumber(5)
                .lapDuration(85.5)
                .sector1(28.1)
                .sector2(30.2)
                .sector3(27.2)
                .compound("SOFT")
                .build();

        String json = mapper.writeValueAsString(record);

        assertTrue(json.contains("\"driverNumber\":1"));
        assertTrue(json.contains("\"lapNumber\":5"));
        assertTrue(json.contains("\"lapDuration\":85.5"));
        assertTrue(json.contains("\"compound\":\"SOFT\""));
    }

    @Test
    void lapDataRecord_SerializesNullSectors_AsNull() throws Exception {
        LapDataRecord record = LapDataRecord.builder()
                .driverNumber(44)
                .lapNumber(10)
                .lapDuration(92.456)
                .build();

        String json = mapper.writeValueAsString(record);

        assertTrue(json.contains("\"driverNumber\":44"));
        assertTrue(json.contains("\"lapDuration\":92.456"));
        assertTrue(json.contains("\"sector1\":null"));
        assertTrue(json.contains("\"compound\":null"));
    }
}
