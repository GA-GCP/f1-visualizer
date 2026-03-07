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

    @ParameterizedTest(name = "speed (avg position): avgPos={0} -> expected={1}")
    @CsvSource({
            "1.0, 99",    // Best possible: 100 - (1-1)*(90/19) = 100, min(99,100) = 99
            "5.0, 81",    // 100 - (5-1)*(90/19) = 100 - 18.9 = 81
            "10.0, 57",   // 100 - (10-1)*(90/19) = 100 - 42.6 = 57
            "20.0, 10",   // 100 - (20-1)*(90/19) = 100 - 90 = 10
    })
    void getDriverStats_CalculatesSpeedScore_FromAvgPosition(double avgPos, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue avgPosVal = mock(FieldValue.class);
        when(avgPosVal.isNull()).thenReturn(false);
        when(avgPosVal.getDoubleValue()).thenReturn(avgPos);
        when(mockRow.get("avg_position")).thenReturn(avgPosVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getSpeed());
    }

    @ParameterizedTest(name = "consistency (position stddev): stdDev={0} -> expected={1}")
    @CsvSource({
            "0.0, 99",    // Perfect consistency: 100 - 0*7 = 100, min(99,100) = 99
            "1.0, 93",    // 100 - 1*7 = 93
            "3.0, 79",    // 100 - 3*7 = 79
            "5.0, 65",    // 100 - 5*7 = 65
            "13.0, 10",   // 100 - 13*7 = 9, max(10,9) = 10
    })
    void getDriverStats_CalculatesConsistencyScore_FromPositionStdDev(double stdDev, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue stdDevVal = mock(FieldValue.class);
        when(stdDevVal.isNull()).thenReturn(false);
        when(stdDevVal.getDoubleValue()).thenReturn(stdDev);
        when(mockRow.get("position_stddev")).thenReturn(stdDevVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getConsistency());
    }

    @ParameterizedTest(name = "aggression (full throttle %): pct={0} -> expected={1}")
    @CsvSource({
            "60.0, 90",   // 60 * 1.5 = 90
            "40.0, 60",   // 40 * 1.5 = 60
            "5.0, 10",    // 5 * 1.5 = 7.5, max(10, 8) = 10
            "70.0, 99",   // 70 * 1.5 = 105, min(99, 105) = 99
    })
    void getDriverStats_CalculatesAggressionScore_FromThrottlePct(double pct, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue throttleVal = mock(FieldValue.class);
        when(throttleVal.isNull()).thenReturn(false);
        when(throttleVal.getDoubleValue()).thenReturn(pct);
        when(mockRow.get("full_throttle_pct")).thenReturn(throttleVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getAggression());
    }

    @ParameterizedTest(name = "tireMgmt (avg stint length): stintLen={0} -> expected={1}")
    @CsvSource({
            "15.0, 48",    // (15/25)*80 = 48
            "25.0, 80",    // (25/25)*80 = 80
            "30.0, 96",    // (30/25)*80 = 96
            "1.0, 10",     // (1/25)*80 = 3.2, max(10,3) = 10
            "35.0, 99",    // (35/25)*80 = 112, min(99,112) = 99
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

    @ParameterizedTest(name = "experience (total races): races={0} -> expected={1}")
    @CsvSource({
            "0, 0",        // No races
            "20, 25",      // (20/80)*99 = 24.75 → round = 25
            "40, 50",      // (40/80)*99 = 49.5 → round = 50
            "80, 99",      // (80/80)*99 = 99
            "100, 99",     // Capped at 99
    })
    void getDriverStats_CalculatesExperienceScore_FromTotalRaces(long races, int expected) throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue racesVal = mock(FieldValue.class);
        when(racesVal.isNull()).thenReturn(false);
        when(racesVal.getLongValue()).thenReturn(races);
        when(mockRow.get("total_races")).thenReturn(racesVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(expected, stats.getExperience());
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
    void getDriverStats_MapsNewCareerFields_Correctly() throws InterruptedException {
        setupMockRowWithAllNulls();

        FieldValue totalPointsVal = mock(FieldValue.class);
        when(totalPointsVal.isNull()).thenReturn(false);
        when(totalPointsVal.getLongValue()).thenReturn(250L);
        when(mockRow.get("total_points")).thenReturn(totalPointsVal);

        FieldValue bestFinishVal = mock(FieldValue.class);
        when(bestFinishVal.isNull()).thenReturn(false);
        when(bestFinishVal.getLongValue()).thenReturn(2L);
        when(mockRow.get("best_finish")).thenReturn(bestFinishVal);

        FieldValue totalRacesVal = mock(FieldValue.class);
        when(totalRacesVal.isNull()).thenReturn(false);
        when(totalRacesVal.getLongValue()).thenReturn(45L);
        when(mockRow.get("total_races")).thenReturn(totalRacesVal);

        FieldValue teamsVal = mock(FieldValue.class);
        when(teamsVal.isNull()).thenReturn(false);
        when(teamsVal.getStringValue()).thenReturn("McLaren|Red Bull Racing");
        when(mockRow.get("teams_list")).thenReturn(teamsVal);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(250, stats.getTotalPoints());
        assertEquals(2, stats.getBestChampionshipFinish());
        assertEquals(45, stats.getTotalRaces());
        assertEquals(List.of("McLaren", "Red Bull Racing"), stats.getTeamsDrivenFor());
    }

    @Test
    void getDriverStats_ReturnsDefaults_WhenAllFieldsAreNull() throws InterruptedException {
        setupMockRowWithAllNulls();

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        // All defaults from the initialization block
        assertEquals(50, stats.getSpeed());
        assertEquals(50, stats.getConsistency());
        assertEquals(30, stats.getExperience());
        assertEquals(50, stats.getAggression());
        assertEquals(50, stats.getTireMgmt());
        assertEquals(0, stats.getWins());
        assertEquals(0, stats.getPodiums());
        assertEquals(0, stats.getTotalPoints());
        assertEquals(0, stats.getBestChampionshipFinish());
        assertEquals(0, stats.getTotalRaces());
        assertEquals(List.of(), stats.getTeamsDrivenFor());
    }

    @Test
    void getDriverStats_ReturnsFallbackDefaults_WhenBigQueryThrows() throws InterruptedException {
        when(bigQuery.query(any(QueryJobConfiguration.class)))
                .thenThrow(new BigQueryException(500, "Internal Error"));

        DriverProfile.DriverStats stats = raceAnalysisService.getDriverStats(1);

        assertEquals(50, stats.getSpeed());
        assertEquals(50, stats.getConsistency());
        assertEquals(30, stats.getExperience());
        assertEquals(50, stats.getAggression());
        assertEquals(50, stats.getTireMgmt());
        assertEquals(0, stats.getWins());
        assertEquals(0, stats.getPodiums());
        assertEquals(0, stats.getTotalPoints());
        assertEquals(0, stats.getBestChampionshipFinish());
        assertEquals(0, stats.getTotalRaces());
        assertEquals(List.of(), stats.getTeamsDrivenFor());
    }

    private void setupMockRowWithAllNulls() {
        FieldValue nullField = mock(FieldValue.class);
        when(nullField.isNull()).thenReturn(true);

        when(mockRow.get("avg_position")).thenReturn(nullField);
        when(mockRow.get("position_stddev")).thenReturn(nullField);
        when(mockRow.get("full_throttle_pct")).thenReturn(nullField);
        when(mockRow.get("avg_stint_length")).thenReturn(nullField);
        when(mockRow.get("total_races")).thenReturn(nullField);
        when(mockRow.get("wins")).thenReturn(nullField);
        when(mockRow.get("podiums")).thenReturn(nullField);
        when(mockRow.get("total_points")).thenReturn(nullField);
        when(mockRow.get("best_finish")).thenReturn(nullField);
        when(mockRow.get("teams_list")).thenReturn(nullField);
    }
}
