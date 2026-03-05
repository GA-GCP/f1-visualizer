package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.google.cloud.bigquery.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HistoricalLocationRepositoryTest {

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private HistoricalLocationRepository historicalLocationRepository;

    private FieldValue longFieldValue(long value) {
        FieldValue fv = mock(FieldValue.class);
        when(fv.getLongValue()).thenReturn(value);
        return fv;
    }

    private FieldValue timestampFieldValue(long epochMicros) {
        FieldValue fv = mock(FieldValue.class);
        when(fv.getTimestampValue()).thenReturn(epochMicros);
        return fv;
    }

    private FieldValue nullFieldValue() {
        FieldValue fv = mock(FieldValue.class);
        when(fv.isNull()).thenReturn(true);
        return fv;
    }

    private FieldValue nullableLongFieldValue(long value) {
        FieldValue fv = mock(FieldValue.class);
        when(fv.isNull()).thenReturn(false);
        when(fv.getLongValue()).thenReturn(value);
        return fv;
    }

    private FieldValueList mockLocationRow(long meetingKey, int driverNumber,
                                            int x, int y, int z, long epochMicros) {
        // Pre-create FieldValue mocks to avoid nested when() calls
        FieldValue meetingKeyFv = nullableLongFieldValue(meetingKey);
        FieldValue driverNumberFv = longFieldValue(driverNumber);
        FieldValue xFv = longFieldValue(x);
        FieldValue yFv = longFieldValue(y);
        FieldValue zFv = longFieldValue(z);
        FieldValue dateFv = timestampFieldValue(epochMicros);

        FieldValueList row = mock(FieldValueList.class);
        when(row.get("meeting_key")).thenReturn(meetingKeyFv);
        when(row.get("driver_number")).thenReturn(driverNumberFv);
        when(row.get("x")).thenReturn(xFv);
        when(row.get("y")).thenReturn(yFv);
        when(row.get("z")).thenReturn(zFv);
        when(row.get("date")).thenReturn(dateFv);
        return row;
    }

    // --- fetchSessionLocations tests (existing, preserved) ---

    @Test
    void fetchSessionLocations_ReturnsParsedData_WhenBigQueryReturnsRows() throws Exception {
        FieldValueList row = mockLocationRow(1219, 1, 1200, 3400, 100, 1694952000000000L);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1LocationData> result = historicalLocationRepository.fetchSessionLocations(9165);

        assertEquals(1, result.size());
        OpenF1LocationData data = result.get(0);
        assertEquals(9165L, data.getSessionKey());
        assertEquals(1219L, data.getMeetingKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(1200, data.getX());
        assertEquals(3400, data.getY());
        assertEquals(100, data.getZ());
        assertEquals(OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC), data.getDate());
    }

    @Test
    void fetchSessionLocations_HandlesNullMeetingKey_Gracefully() throws Exception {
        // Pre-create FieldValue mocks to avoid nested when() calls
        FieldValue meetingKey = nullFieldValue();
        FieldValue driverNum = longFieldValue(1);
        FieldValue x = longFieldValue(1200);
        FieldValue y = longFieldValue(3400);
        FieldValue z = longFieldValue(100);
        FieldValue date = timestampFieldValue(1694952000000000L);

        FieldValueList row = mock(FieldValueList.class);
        when(row.get("meeting_key")).thenReturn(meetingKey);
        when(row.get("driver_number")).thenReturn(driverNum);
        when(row.get("x")).thenReturn(x);
        when(row.get("y")).thenReturn(y);
        when(row.get("z")).thenReturn(z);
        when(row.get("date")).thenReturn(date);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1LocationData> result = historicalLocationRepository.fetchSessionLocations(9165);

        assertEquals(1, result.size());
        assertNull(result.get(0).getMeetingKey());
        assertEquals(1, result.get(0).getDriverNumber());
    }

    @Test
    void fetchSessionLocations_ReturnsEmptyList_WhenBigQueryReturnsNoRows() throws Exception {
        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of());
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1LocationData> result = historicalLocationRepository.fetchSessionLocations(9999);

        assertTrue(result.isEmpty());
    }

    @Test
    void fetchSessionLocations_ReturnsEmptyList_WhenBigQueryThrows() throws Exception {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new InterruptedException("Query interrupted"));

        List<OpenF1LocationData> result = historicalLocationRepository.fetchSessionLocations(9165);

        assertTrue(result.isEmpty());
    }

    // --- fetchLocationWindow tests ---

    @Test
    void fetchLocationWindow_ReturnsParsedData_WithTimeRange() throws Exception {
        FieldValueList row = mockLocationRow(1219, 1, 1200, 3400, 100, 1694952000000000L);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        List<OpenF1LocationData> result = historicalLocationRepository.fetchLocationWindow(9165, from, to);

        assertEquals(1, result.size());
        assertEquals(1200, result.get(0).getX());
        assertEquals(9165L, result.get(0).getSessionKey());
    }

    @Test
    void fetchLocationWindow_ReturnsEmptyList_WhenBigQueryThrows() throws Exception {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new InterruptedException("Query interrupted"));

        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        List<OpenF1LocationData> result = historicalLocationRepository.fetchLocationWindow(9165, from, to);

        assertTrue(result.isEmpty());
    }
}
