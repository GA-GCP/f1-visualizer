package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LapData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1StintData;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.InsertAllRequest;
import com.google.cloud.bigquery.InsertAllResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LapDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private LapDataLoader lapDataLoader;

    @Test
    void loadLapsIntoBigQuery_EnrichesLapsWithCompound_WhenStintDataAvailable() {
        long sessionKey = 9165L;

        // Create a lap at lap_number=5 for driver 1
        OpenF1LapData lap = new OpenF1LapData();
        lap.setSessionKey(sessionKey);
        lap.setMeetingKey(1234L);
        lap.setDriverNumber(1);
        lap.setLapNumber(5);
        lap.setLapDuration(85.5);
        lap.setDateStart(OffsetDateTime.parse("2024-03-02T15:10:00+00:00"));
        lap.setIsPitOutLap(true);

        // Create a stint covering laps 1-10 with SOFT compound
        OpenF1StintData stint = new OpenF1StintData();
        stint.setDriverNumber(1);
        stint.setLapStart(1);
        stint.setLapEnd(10);
        stint.setCompound("SOFT");

        when(openF1Client.getLapData(sessionKey)).thenReturn(Flux.just(lap));
        when(openF1Client.getStintData(sessionKey)).thenReturn(Flux.just(stint));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        lapDataLoader.loadLapsIntoBigQuery(sessionKey);

        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, times(1)).insertAll(captor.capture());

        InsertAllRequest request = captor.getValue();
        assertEquals(1, request.getRows().size());

        Map<String, Object> rowContent = request.getRows().get(0).getContent();
        assertEquals("SOFT", rowContent.get("compound"));
        assertNotNull(rowContent.get("date_start"));
        assertEquals(true, rowContent.get("is_pit_out_lap"));
    }

    @Test
    void loadLapsIntoBigQuery_ReturnsEarly_WhenNoLapDataFound() {
        when(openF1Client.getLapData(9165L)).thenReturn(Flux.empty());

        lapDataLoader.loadLapsIntoBigQuery(9165L);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadLapsIntoBigQuery_HandlesStintDataFetchFailure_GracefullyDegrades() {
        long sessionKey = 9165L;

        OpenF1LapData lap = new OpenF1LapData();
        lap.setSessionKey(sessionKey);
        lap.setMeetingKey(1234L);
        lap.setDriverNumber(1);
        lap.setLapNumber(3);
        lap.setLapDuration(90.0);

        // Lap data succeeds, but stint data throws
        when(openF1Client.getLapData(sessionKey)).thenReturn(Flux.just(lap));
        when(openF1Client.getStintData(sessionKey)).thenReturn(Flux.error(new RuntimeException("API Error")));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        // Should not throw - degrades gracefully without compound enrichment
        lapDataLoader.loadLapsIntoBigQuery(sessionKey);

        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, times(1)).insertAll(captor.capture());

        Map<String, Object> rowContent = captor.getValue().getRows().get(0).getContent();
        assertNull(rowContent.get("compound")); // No compound since stint fetch failed
    }
}
