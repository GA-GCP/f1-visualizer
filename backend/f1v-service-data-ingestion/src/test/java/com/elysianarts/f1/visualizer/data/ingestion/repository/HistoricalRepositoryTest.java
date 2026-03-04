package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.google.cloud.bigquery.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HistoricalRepositoryTest {

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private HistoricalRepository historicalRepository;

    private FieldValue longFieldValue(long value) {
        FieldValue fv = mock(FieldValue.class);
        when(fv.getLongValue()).thenReturn(value);
        return fv;
    }

    private FieldValue stringFieldValue(String value) {
        FieldValue fv = mock(FieldValue.class);
        when(fv.getStringValue()).thenReturn(value);
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

    @Test
    void fetchSessionTelemetry_ReturnsParsedData_WhenBigQueryReturnsRows() throws Exception {
        // Pre-create FieldValue mocks to avoid nested when() calls
        FieldValue meetingKey = nullableLongFieldValue(1219);
        FieldValue driverNum = longFieldValue(1);
        FieldValue speed = longFieldValue(310);
        FieldValue rpm = longFieldValue(11500);
        FieldValue gear = longFieldValue(8);
        FieldValue throttle = longFieldValue(100);
        FieldValue brake = longFieldValue(0);
        FieldValue drs = longFieldValue(1);
        FieldValue date = stringFieldValue("2023-09-17T12:00:00.000Z");

        FieldValueList row = mock(FieldValueList.class);
        when(row.get("meeting_key")).thenReturn(meetingKey);
        when(row.get("driver_number")).thenReturn(driverNum);
        when(row.get("speed")).thenReturn(speed);
        when(row.get("rpm")).thenReturn(rpm);
        when(row.get("gear")).thenReturn(gear);
        when(row.get("throttle")).thenReturn(throttle);
        when(row.get("brake")).thenReturn(brake);
        when(row.get("drs")).thenReturn(drs);
        when(row.get("date")).thenReturn(date);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1CarData> result = historicalRepository.fetchSessionTelemetry(9165);

        assertEquals(1, result.size());
        OpenF1CarData data = result.get(0);
        assertEquals(9165L, data.getSessionKey());
        assertEquals(1219L, data.getMeetingKey());
        assertEquals(1, data.getDriverNumber());
        assertEquals(310, data.getSpeed());
        assertEquals(8, data.getGear());
    }

    @Test
    void fetchSessionTelemetry_HandlesNullMeetingKey_Gracefully() throws Exception {
        FieldValue meetingKey = nullFieldValue();
        FieldValue driverNum = longFieldValue(1);
        FieldValue speed = longFieldValue(310);
        FieldValue rpm = longFieldValue(11500);
        FieldValue gear = longFieldValue(8);
        FieldValue throttle = longFieldValue(100);
        FieldValue brake = longFieldValue(0);
        FieldValue drs = longFieldValue(1);
        FieldValue date = stringFieldValue("2023-09-17T12:00:00.000Z");

        FieldValueList row = mock(FieldValueList.class);
        when(row.get("meeting_key")).thenReturn(meetingKey);
        when(row.get("driver_number")).thenReturn(driverNum);
        when(row.get("speed")).thenReturn(speed);
        when(row.get("rpm")).thenReturn(rpm);
        when(row.get("gear")).thenReturn(gear);
        when(row.get("throttle")).thenReturn(throttle);
        when(row.get("brake")).thenReturn(brake);
        when(row.get("drs")).thenReturn(drs);
        when(row.get("date")).thenReturn(date);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1CarData> result = historicalRepository.fetchSessionTelemetry(9165);

        assertEquals(1, result.size());
        assertNull(result.get(0).getMeetingKey());
        assertEquals(1, result.get(0).getDriverNumber());
    }

    @Test
    void fetchSessionTelemetry_ReturnsEmptyList_WhenBigQueryReturnsNoRows() throws Exception {
        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of());
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        List<OpenF1CarData> result = historicalRepository.fetchSessionTelemetry(9999);

        assertTrue(result.isEmpty());
    }

    @Test
    void fetchSessionTelemetry_ReturnsEmptyList_WhenBigQueryThrows() throws Exception {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new InterruptedException("Query interrupted"));

        List<OpenF1CarData> result = historicalRepository.fetchSessionTelemetry(9165);

        assertTrue(result.isEmpty());
    }
}
