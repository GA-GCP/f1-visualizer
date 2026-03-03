package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.google.cloud.bigquery.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RaceAnalysisServiceTest {
    @Mock
    private BigQuery bigQuery;

    @Mock
    private TableResult tableResult;

    @Mock
    private FieldValueList mockRow;

    @Mock
    private FieldValue mockValue;

    @InjectMocks
    private RaceAnalysisService raceAnalysisService;

    @Test
    void getSessionLapTimes_ReturnsMappedRecords_WhenQuerySucceeds() throws InterruptedException {
        // Arrange
        long sessionKey = 9165L;

        // 1. Mock the specific column retrievals for a single row
        // Driver Number: 1
        FieldValue driverNumVal = mock(FieldValue.class);
        when(driverNumVal.getLongValue()).thenReturn(1L);
        when(mockRow.get("driver_number")).thenReturn(driverNumVal);

        // Lap Number: 5
        FieldValue lapNumVal = mock(FieldValue.class);
        when(lapNumVal.getLongValue()).thenReturn(5L);
        when(mockRow.get("lap_number")).thenReturn(lapNumVal);

        // Lap Duration: 85.5
        FieldValue lapDurVal = mock(FieldValue.class);
        when(lapDurVal.isNull()).thenReturn(false);
        when(lapDurVal.getDoubleValue()).thenReturn(85.5);
        when(mockRow.get("lap_duration")).thenReturn(lapDurVal);

        // Sector 1: 20.1
        FieldValue s1Val = mock(FieldValue.class);
        when(s1Val.isNull()).thenReturn(false);
        when(s1Val.getDoubleValue()).thenReturn(20.1);
        when(mockRow.get("sector_1_duration")).thenReturn(s1Val);

        // Sector 2: 30.2
        FieldValue s2Val = mock(FieldValue.class);
        when(s2Val.isNull()).thenReturn(false);
        when(s2Val.getDoubleValue()).thenReturn(30.2);
        when(mockRow.get("sector_2_duration")).thenReturn(s2Val);

        // Sector 3: 35.2
        FieldValue s3Val = mock(FieldValue.class);
        when(s3Val.isNull()).thenReturn(false);
        when(s3Val.getDoubleValue()).thenReturn(35.2);
        when(mockRow.get("sector_3_duration")).thenReturn(s3Val);

        // Compound: SOFT
        FieldValue compoundVal = mock(FieldValue.class);
        when(compoundVal.isNull()).thenReturn(false);
        when(compoundVal.getStringValue()).thenReturn("SOFT");
        when(mockRow.get("compound")).thenReturn(compoundVal);

        // 2. Mock the TableResult to return our single mockRow
        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));

        // 3. Mock the BigQuery client execution
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        // Act
        List<LapDataRecord> results = raceAnalysisService.getSessionLapTimes(sessionKey);

        // Assert
        assertNotNull(results);
        assertEquals(1, results.size());

        LapDataRecord record = results.get(0);

        assertEquals(1, record.getDriverNumber());
        assertEquals(5, record.getLapNumber());
        assertEquals(85.5, record.getLapDuration());
        assertEquals(20.1, record.getSector1());
    }

    @Test
    void getSessionLapTimes_HandlesNullValues_Correctly() throws InterruptedException {
        // Arrange: Simulate a lap where sector times are missing (e.g., a crash or pit entry)
        long sessionKey = 9165L;

        // Driver & Lap are required
        FieldValue driverNumVal = mock(FieldValue.class);
        when(driverNumVal.getLongValue()).thenReturn(44L);
        when(mockRow.get("driver_number")).thenReturn(driverNumVal);

        FieldValue lapNumVal = mock(FieldValue.class);
        when(lapNumVal.getLongValue()).thenReturn(10L);
        when(mockRow.get("lap_number")).thenReturn(lapNumVal);

        // Lap Duration is NULL
        FieldValue lapDurVal = mock(FieldValue.class);
        when(lapDurVal.isNull()).thenReturn(true);
        when(mockRow.get("lap_duration")).thenReturn(lapDurVal);

        // Stub other required interactions
        FieldValue nullField = mock(FieldValue.class);
        when(nullField.isNull()).thenReturn(true);
        when(mockRow.get("sector_1_duration")).thenReturn(nullField);
        when(mockRow.get("sector_2_duration")).thenReturn(nullField);
        when(mockRow.get("sector_3_duration")).thenReturn(nullField);
        when(mockRow.get("compound")).thenReturn(nullField);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        // Act
        List<LapDataRecord> results = raceAnalysisService.getSessionLapTimes(sessionKey);

        // Assert
        assertNotNull(results);

        assertNull(results.get(0).getLapDuration(), "Lap duration should be null");
        assertNull(results.get(0).getSector1(), "Sector 1 should be null");
        assertNull(results.get(0).getCompound(), "Compound should be null");
    }

    @Test
    void getSessionLapTimes_ThrowsRuntimeException_WhenBigQueryFails() throws InterruptedException {
        // Arrange
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new BigQueryException(500, "Internal Error"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            raceAnalysisService.getSessionLapTimes(123L);
        });

        assertTrue(exception.getMessage().contains("Failed to fetch analysis data"));
    }
}