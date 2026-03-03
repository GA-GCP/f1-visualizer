package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.google.cloud.bigquery.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RaceAnalysisServiceGetDriverStatsTest {

    @Mock
    private BigQuery bigQuery;

    @Mock
    private TableResult tableResult;

    @Mock
    private FieldValueList mockRow;

    @InjectMocks
    private RaceAnalysisService raceAnalysisService;

    @ParameterizedTest(name = "speed: maxSpeed={0} -> expected={1}")
    @CsvSource({
            "350.0, 99",   // max boundary: (350/350)*100 = 100, min(99,100) = 99
            "0.0, 0",      // zero speed
            "175.0, 50",   // mid-range: (175/350)*100 = 50
            "700.0, 99",   // above cap: (700/350)*100 = 200, min(99,200) = 99
    })
    void getDriverStats_CalculatesSpeedScore_Correctly(double maxSpeed, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue speedVal = mock(FieldValue.class);
        when(speedVal.isNull()).thenReturn(false);
        when(speedVal.getDoubleValue()).thenReturn(maxSpeed);
        when(mockRow.get("max_speed")).thenReturn(speedVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getSpeed());
    }

    @ParameterizedTest(name = "consistency: stdDev={0} -> expected={1}")
    @CsvSource({
            "0.0, 100",    // perfect consistency: 100 - (0*10) = 100, max(10,100) = 100
            "1.0, 90",     // 100 - (1*10) = 90
            "5.0, 50",     // 100 - (5*10) = 50
            "9.0, 10",     // 100 - (9*10) = 10, max(10,10) = 10
            "15.0, 10",    // 100 - (15*10) = -50, max(10,-50) = 10
    })
    void getDriverStats_CalculatesConsistencyScore_Correctly(double stdDev, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue stdDevVal = mock(FieldValue.class);
        when(stdDevVal.isNull()).thenReturn(false);
        when(stdDevVal.getDoubleValue()).thenReturn(stdDev);
        when(mockRow.get("lap_stddev")).thenReturn(stdDevVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getConsistency());
    }

    @ParameterizedTest(name = "experience: sessions={0} -> expected={1}")
    @CsvSource({
            "0, 0",        // no sessions: (0/20)*100 = 0
            "10, 50",      // (10/20)*100 = 50
            "20, 99",      // (20/20)*100 = 100, min(99,100) = 99
            "50, 99",      // capped at 99
    })
    void getDriverStats_CalculatesExperienceScore_Correctly(long sessions, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue sessionsVal = mock(FieldValue.class);
        when(sessionsVal.isNull()).thenReturn(false);
        when(sessionsVal.getLongValue()).thenReturn(sessions);
        when(mockRow.get("sessions_participated")).thenReturn(sessionsVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getExperience());
    }

    @ParameterizedTest(name = "aggression: avgBrake={0} -> expected={1}")
    @CsvSource({
            "50.0, 50",    // mid-range
            "5.0, 10",     // below floor: max(10, 5) = 10
            "99.0, 99",    // at cap
            "150.0, 99",   // above cap: min(99, 150) = 99
    })
    void getDriverStats_CalculatesAggressionScore_Correctly(double avgBrake, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue brakeVal = mock(FieldValue.class);
        when(brakeVal.isNull()).thenReturn(false);
        when(brakeVal.getDoubleValue()).thenReturn(avgBrake);
        when(mockRow.get("avg_brake")).thenReturn(brakeVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getAggression());
    }

    @ParameterizedTest(name = "tireMgmt: avgStintLen={0} -> expected={1}")
    @CsvSource({
            "15.0, 50",    // (15/30)*100 = 50
            "30.0, 99",    // (30/30)*100 = 100, min(99,100) = 99
            "1.0, 10",     // (1/30)*100 = 3.3, max(10,3) = 10
            "60.0, 99",    // above cap
    })
    void getDriverStats_CalculatesTireMgmtScore_Correctly(double avgStintLen, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue stintVal = mock(FieldValue.class);
        when(stintVal.isNull()).thenReturn(false);
        when(stintVal.getDoubleValue()).thenReturn(avgStintLen);
        when(mockRow.get("avg_stint_length")).thenReturn(stintVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getTireMgmt());
    }

    @Test
    void getDriverStats_MapsWinsAndPodiums_Correctly() throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue winsVal = mock(FieldValue.class);
        when(winsVal.isNull()).thenReturn(false);
        when(winsVal.getLongValue()).thenReturn(5L);
        when(mockRow.get("wins")).thenReturn(winsVal);

        FieldValue podiumsVal = mock(FieldValue.class);
        when(podiumsVal.isNull()).thenReturn(false);
        when(podiumsVal.getLongValue()).thenReturn(12L);
        when(mockRow.get("podiums")).thenReturn(podiumsVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(5, stats.getWins());
        assertEquals(12, stats.getPodiums());
    }

    @Test
    void getDriverStats_ReturnsDefaults_WhenAllFieldsAreNull() throws InterruptedException {
        setupMockRowWithAllNulls();

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        // All defaults from the initialization block
        assertEquals(80, stats.getSpeed());
        assertEquals(80, stats.getConsistency());
        assertEquals(50, stats.getExperience());
        assertEquals(85, stats.getAggression());
        assertEquals(85, stats.getTireMgmt());
        assertEquals(0, stats.getWins());
        assertEquals(0, stats.getPodiums());
    }

    @Test
    void getDriverStats_ReturnsFallbackDefaults_WhenBigQueryThrows() throws InterruptedException {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new BigQueryException(500, "Internal Error"));

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(80, stats.getSpeed());
        assertEquals(80, stats.getConsistency());
        assertEquals(50, stats.getExperience());
        assertEquals(80, stats.getAggression());
        assertEquals(80, stats.getTireMgmt());
        assertEquals(0, stats.getWins());
        assertEquals(0, stats.getPodiums());
    }

    private void setupMockRowWithAllNulls() {
        FieldValue nullField = mock(FieldValue.class);
        when(nullField.isNull()).thenReturn(true);

        when(mockRow.get("max_speed")).thenReturn(nullField);
        when(mockRow.get("lap_stddev")).thenReturn(nullField);
        when(mockRow.get("sessions_participated")).thenReturn(nullField);
        when(mockRow.get("wins")).thenReturn(nullField);
        when(mockRow.get("podiums")).thenReturn(nullField);
        when(mockRow.get("avg_brake")).thenReturn(nullField);
        when(mockRow.get("avg_stint_length")).thenReturn(nullField);
    }
}
