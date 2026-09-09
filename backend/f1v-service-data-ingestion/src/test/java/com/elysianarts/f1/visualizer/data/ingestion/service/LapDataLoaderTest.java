package com.elysianarts.f1.visualizer.data.ingestion.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LapData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1StintData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryProperties;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LapDataLoaderTest {

    @Mock private OpenF1Client openF1Client;

    @Mock private BigQueryBatchWriter batchWriter;

    @Mock private BigQueryQueryRunner queryRunner;

    @InjectMocks private LapDataLoader lapDataLoader;

    @BeforeEach
    void stubDataset() {
        // C4: the dataset name is configuration now, not a constant per class.
        lenient().when(queryRunner.properties()).thenReturn(BigQueryProperties.defaults());
    }

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

        when(openF1Client.getLapData(sessionKey)).thenReturn(List.of(lap));
        when(openF1Client.getStintData(sessionKey)).thenReturn(List.of(stint));

        lapDataLoader.loadLapsIntoBigQuery(sessionKey);

        ArgumentCaptor<List<Map<String, Object>>> captor = ArgumentCaptor.captor();
        verify(batchWriter, times(1)).append(eq("f1_dataset"), eq("laps"), captor.capture());
        assertEquals(1, captor.getValue().size());

        Map<String, Object> rowContent = captor.getValue().get(0);
        assertEquals("SOFT", rowContent.get("compound"));
        assertNotNull(rowContent.get("date_start"));
        assertEquals(true, rowContent.get("is_pit_out_lap"));
    }

    @Test
    void loadLapsIntoBigQuery_ReturnsEarly_WhenNoLapDataFound() {
        when(openF1Client.getLapData(9165L)).thenReturn(List.of());

        lapDataLoader.loadLapsIntoBigQuery(9165L);

        verify(batchWriter, never()).append(any(), any(), any());
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
        when(openF1Client.getLapData(sessionKey)).thenReturn(List.of(lap));
        when(openF1Client.getStintData(sessionKey)).thenThrow(new RuntimeException("API Error"));

        // Should not throw - degrades gracefully without compound enrichment
        lapDataLoader.loadLapsIntoBigQuery(sessionKey);

        ArgumentCaptor<List<Map<String, Object>>> captor = ArgumentCaptor.captor();
        verify(batchWriter, times(1)).append(eq("f1_dataset"), eq("laps"), captor.capture());

        Map<String, Object> rowContent = captor.getValue().get(0);
        assertNull(rowContent.get("compound")); // No compound since stint fetch failed
    }
}
