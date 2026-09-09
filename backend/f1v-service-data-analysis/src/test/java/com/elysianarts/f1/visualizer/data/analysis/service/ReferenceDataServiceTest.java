package com.elysianarts.f1.visualizer.data.analysis.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.repository.ReferenceDataCacheRepository;
import com.google.cloud.bigquery.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReferenceDataServiceTest {

    @Mock private BigQuery bigQuery;

    @Mock private ReferenceDataCacheRepository cacheRepository;

    @Mock private TableResult tableResult;

    @Mock private FieldValueList mockRow;

    private ReferenceDataService referenceDataService;

    @BeforeEach
    void initService() {
        // The runner applies the job timeout and byte ceiling (R6); the
        // BigQuery mock underneath it is still what the tests stub.
        referenceDataService =
                new ReferenceDataService(
                        BigQueryQueryRunner.withDefaults(bigQuery),
                        cacheRepository,
                        new org.springframework.core.task.SyncTaskExecutor());
    }

    @Test
    void searchSessions_MapsBigQueryResultsCorrectly() throws InterruptedException {
        // Arrange
        FieldValue sessionKeyVal = mock(FieldValue.class);
        when(sessionKeyVal.getLongValue()).thenReturn(9165L);
        when(mockRow.get("session_key")).thenReturn(sessionKeyVal);

        FieldValue meetingNameVal = mock(FieldValue.class);
        when(meetingNameVal.isNull()).thenReturn(false);
        when(meetingNameVal.getStringValue()).thenReturn("Singapore Grand Prix");
        when(mockRow.get("meeting_name")).thenReturn(meetingNameVal);

        // Stub other required columns to prevent NullPointers
        FieldValue defaultNull = mock(FieldValue.class);
        when(defaultNull.isNull()).thenReturn(true);
        when(mockRow.get("session_name")).thenReturn(defaultNull);
        when(mockRow.get("year")).thenReturn(defaultNull);
        when(mockRow.get("country_name")).thenReturn(defaultNull);

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        // Act
        List<RaceSession> results = referenceDataService.searchSessions("Singapore");

        // Assert
        assertEquals(1, results.size());
        assertEquals(9165L, results.get(0).getSessionKey());
        assertEquals("Singapore Grand Prix", results.get(0).getMeetingName());
    }

    @Test
    void getMasterDriverList_GeneratesCodeAndMapsColor() throws InterruptedException {
        // Arrange — cache miss forces BigQuery fallback
        when(cacheRepository.getCachedDrivers()).thenReturn(List.of());

        FieldValue driverNumVal = mock(FieldValue.class);
        when(driverNumVal.getLongValue()).thenReturn(16L);
        when(mockRow.get("driver_number")).thenReturn(driverNumVal);

        FieldValue broadcastNameVal = mock(FieldValue.class);
        when(broadcastNameVal.isNull()).thenReturn(false);
        when(broadcastNameVal.getStringValue()).thenReturn("CHARLES LEC");
        when(mockRow.get("broadcast_name")).thenReturn(broadcastNameVal);

        FieldValue teamColorVal = mock(FieldValue.class);
        when(teamColorVal.isNull()).thenReturn(false);
        when(teamColorVal.getStringValue()).thenReturn("E80020");
        when(mockRow.get("team_colour")).thenReturn(teamColorVal);

        FieldValue nameAcronymVal = mock(FieldValue.class);
        when(nameAcronymVal.isNull()).thenReturn(false);
        when(nameAcronymVal.getStringValue()).thenReturn("LEC");
        when(mockRow.get("name_acronym")).thenReturn(nameAcronymVal);

        FieldValue defaultNull = mock(FieldValue.class);
        when(defaultNull.isNull()).thenReturn(true);
        when(mockRow.get("team_name")).thenReturn(defaultNull);
        // C8: the list carries the same precomputed stats as /drivers/{id}/stats
        // rather than a 50/50/50/30 placeholder that was then cached as data.
        for (String statsColumn :
                new String[] {
                    "avg_position",
                    "position_stddev",
                    "full_throttle_pct",
                    "avg_stint_length",
                    "total_races",
                    "wins",
                    "podiums",
                    "total_points",
                    "best_finish",
                    "teams_list"
                }) {
            when(mockRow.get(statsColumn)).thenReturn(defaultNull);
        }

        when(tableResult.iterateAll()).thenReturn(List.of(mockRow));
        when(bigQuery.query(any(QueryJobConfiguration.class))).thenReturn(tableResult);

        // Act
        List<DriverProfile> results = referenceDataService.getMasterDriverList();

        // Assert
        assertEquals(1, results.size());
        assertEquals(16, results.get(0).getId());
        assertEquals("LEC", results.get(0).getCode()); // Uses name_acronym from OpenF1
        assertEquals("#E80020", results.get(0).getTeamColor()); // Hash prefixed
    }
}
