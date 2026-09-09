package com.elysianarts.f1.visualizer.replay.repository;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryAccessException;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.replay.model.SessionBounds;
import com.google.cloud.bigquery.*;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HistoricalRepositoryTest {

    @Mock private BigQuery bigQuery;

    private HistoricalRepository historicalRepository;

    @BeforeEach
    void initService() {
        // The runner applies the job timeout and byte ceiling (R6); the
        // BigQuery mock underneath it is still what the tests stub.
        historicalRepository = new HistoricalRepository(BigQueryQueryRunner.withDefaults(bigQuery));
    }

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

    private FieldValueList mockTelemetryRow(
            long meetingKey,
            int driverNumber,
            int speed,
            int rpm,
            int gear,
            int throttle,
            int brake,
            int drs,
            long epochMicros) {
        // Create mock FieldValues BEFORE setting up row stubs to avoid nested when() calls
        FieldValue meetingKeyFv = nullableLongFieldValue(meetingKey);
        FieldValue driverNumberFv = longFieldValue(driverNumber);
        FieldValue speedFv = longFieldValue(speed);
        FieldValue rpmFv = longFieldValue(rpm);
        FieldValue gearFv = longFieldValue(gear);
        FieldValue throttleFv = longFieldValue(throttle);
        FieldValue brakeFv = longFieldValue(brake);
        FieldValue drsFv = longFieldValue(drs);
        FieldValue dateFv = timestampFieldValue(epochMicros);

        FieldValueList row = mock(FieldValueList.class);
        when(row.get("meeting_key")).thenReturn(meetingKeyFv);
        when(row.get("driver_number")).thenReturn(driverNumberFv);
        when(row.get("speed")).thenReturn(speedFv);
        when(row.get("rpm")).thenReturn(rpmFv);
        when(row.get("gear")).thenReturn(gearFv);
        when(row.get("throttle")).thenReturn(throttleFv);
        when(row.get("brake")).thenReturn(brakeFv);
        when(row.get("drs")).thenReturn(drsFv);
        when(row.get("date")).thenReturn(dateFv);
        return row;
    }

    /**
     * P2: bounds is two queries now — the session's advertised window from the small unpartitioned
     * `sessions` table, then an exact MIN/MAX inside it. The old single query had no date predicate
     * at all, which the telemetry table no longer permits.
     */
    private TableResult sessionWindowResult() {
        FieldValueList row = mock(FieldValueList.class);
        FieldValue start = mock(FieldValue.class);
        when(start.getTimestampValue()).thenReturn(1694948400000000L); // 2023-09-17T11:00:00Z
        FieldValue end = mock(FieldValue.class);
        when(end.isNull()).thenReturn(false);
        when(end.getTimestampValue()).thenReturn(1694962800000000L); // 2023-09-17T15:00:00Z
        when(row.get("date_start")).thenReturn(start);
        when(row.get("date_end")).thenReturn(end);

        TableResult result = mock(TableResult.class);
        when(result.iterateAll()).thenReturn(List.of(row));
        return result;
    }

    // --- fetchTelemetryBounds tests ---

    @Test
    void fetchTelemetryBounds_ReturnsBounds_WhenDataExists() throws Exception {
        long minMicros = 1694952000000000L; // 2023-09-17T12:00:00Z
        long maxMicros = 1694959200000000L; // 2023-09-17T14:00:00Z

        FieldValueList row = mock(FieldValueList.class);
        FieldValue minDate = mock(FieldValue.class);
        when(minDate.isNull()).thenReturn(false);
        when(minDate.getTimestampValue()).thenReturn(minMicros);
        FieldValue maxDate = mock(FieldValue.class);
        when(maxDate.isNull()).thenReturn(false);
        when(maxDate.getTimestampValue()).thenReturn(maxMicros);
        when(row.get("min_date")).thenReturn(minDate);
        when(row.get("max_date")).thenReturn(maxDate);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        TableResult windowResult = sessionWindowResult();
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenReturn(windowResult, tableResult);

        SessionBounds bounds = historicalRepository.fetchTelemetryBounds(9165);

        assertNotNull(bounds);
        assertEquals(9165, bounds.sessionKey());
        assertEquals(
                OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC), bounds.startTime());
        assertEquals(OffsetDateTime.of(2023, 9, 17, 14, 0, 0, 0, ZoneOffset.UTC), bounds.endTime());
        assertFalse(bounds.isEmpty());
    }

    @Test
    void fetchTelemetryBounds_ReturnsNull_WhenSessionIsEmpty() throws Exception {
        FieldValueList row = mock(FieldValueList.class);
        FieldValue nullFv = mock(FieldValue.class);
        when(nullFv.isNull()).thenReturn(true);
        when(row.get("min_date")).thenReturn(nullFv);
        // max_date stub not needed — || short-circuits after min_date.isNull() returns true

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        TableResult windowResult = sessionWindowResult();
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenReturn(windowResult, tableResult);

        SessionBounds bounds = historicalRepository.fetchTelemetryBounds(9999);

        assertNull(bounds);
    }

    @Test
    void fetchTelemetryBounds_Throws_WhenBigQueryFails() throws Exception {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new InterruptedException("Query interrupted"));

        assertThrows(
                BigQueryAccessException.class,
                () -> historicalRepository.fetchTelemetryBounds(9165));
    }

    // --- fetchTelemetryWindow tests ---

    @Test
    void fetchTelemetryWindow_ReturnsParsedData_WithTimeRange() throws Exception {
        FieldValueList row = mockTelemetryRow(1219, 1, 310, 11500, 8, 100, 0, 1, 1694952000000000L);

        TableResult tableResult = mock(TableResult.class);
        when(tableResult.iterateAll()).thenReturn(List.of(row));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        List<OpenF1CarData> result = historicalRepository.fetchTelemetryWindow(9165, from, to);

        assertEquals(1, result.size());
        assertEquals(310, result.get(0).getSpeed());
        assertEquals(9165L, result.get(0).getSessionKey());
    }

    @Test
    void fetchTelemetryWindow_Throws_WhenBigQueryFails() throws Exception {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new InterruptedException("Query interrupted"));

        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        assertThrows(
                BigQueryAccessException.class,
                () -> historicalRepository.fetchTelemetryWindow(9165, from, to));
    }
}
