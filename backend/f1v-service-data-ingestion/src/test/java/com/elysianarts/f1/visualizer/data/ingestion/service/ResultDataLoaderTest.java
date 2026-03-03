package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1PositionData;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResultDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private ResultDataLoader resultDataLoader;

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

        when(openF1Client.getPositionData(sessionKey)).thenReturn(Flux.just(pos1, pos2));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        resultDataLoader.loadResultsIntoBigQuery(sessionKey);

        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, times(1)).insertAll(captor.capture());

        // Should only have 1 row for driver 1 (deduplicated by HashMap)
        assertEquals(1, captor.getValue().getRows().size());
    }

    @Test
    void loadResultsIntoBigQuery_ReturnsEarly_WhenNoPositionDataFound() {
        when(openF1Client.getPositionData(9165L)).thenReturn(Flux.empty());

        resultDataLoader.loadResultsIntoBigQuery(9165L);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }
}
