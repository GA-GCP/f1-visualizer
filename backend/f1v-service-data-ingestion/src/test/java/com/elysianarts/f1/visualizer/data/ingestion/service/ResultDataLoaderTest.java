package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryProperties;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1PositionData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResultDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQueryBatchWriter batchWriter;

    @Mock
    private BigQueryQueryRunner queryRunner;

    @InjectMocks
    private ResultDataLoader resultDataLoader;

    @BeforeEach
    void stubDataset() {
        // C4: the dataset name is configuration now, not a constant per class.
        lenient().when(queryRunner.properties()).thenReturn(BigQueryProperties.defaults());
    }

    @Test
    void loadResultsIntoBigQuery_DeduplicatesPositions_KeepingLatest() {
        long sessionKey = 9165L;

        // Two position updates for the same driver - last one should win
        OpenF1PositionData pos1 = new OpenF1PositionData();
        pos1.setSessionKey(sessionKey);
        pos1.setDriverNumber(1);
        pos1.setPosition(3);

        OpenF1PositionData pos2 = new OpenF1PositionData();
        pos2.setSessionKey(sessionKey);
        pos2.setDriverNumber(1);
        pos2.setPosition(1); // Updated position

        when(openF1Client.getPositionData(sessionKey)).thenReturn(List.of(pos1, pos2));

        resultDataLoader.loadResultsIntoBigQuery(sessionKey);

        ArgumentCaptor<List<Map<String, Object>>> captor = ArgumentCaptor.captor();
        verify(batchWriter, times(1)).append(eq("f1_dataset"), eq("results"), captor.capture());

        // Should only have 1 row for driver 1 (deduplicated by HashMap)
        assertEquals(1, captor.getValue().size());
    }

    @Test
    void loadResultsIntoBigQuery_ReturnsEarly_WhenNoPositionDataFound() {
        when(openF1Client.getPositionData(9165L)).thenReturn(List.of());

        resultDataLoader.loadResultsIntoBigQuery(9165L);

        verify(batchWriter, never()).append(any(), any(), any());
    }
}
