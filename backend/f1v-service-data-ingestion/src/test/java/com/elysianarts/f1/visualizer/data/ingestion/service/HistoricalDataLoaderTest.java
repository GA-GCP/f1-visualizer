package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
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
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HistoricalDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private HistoricalDataLoader historicalDataLoader;

    @Test
    void loadSessionIntoBigQuery_FetchesAndInsertsData() {
        // Arrange
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        // Force a short 10-minute race to avoid multiple loop iterations in the test
        OffsetDateTime endTime = startTime.plusMinutes(10);

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(endTime);

        OpenF1CarData mockCarData = new OpenF1CarData();
        mockCarData.setSessionKey(sessionKey);
        mockCarData.setDriverNumber(1);
        mockCarData.setSpeed(300);
        mockCarData.setDate(startTime.plusMinutes(1));

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));
        when(openF1Client.getCarData(eq(sessionKey), any(), any())).thenReturn(Flux.just(mockCarData));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        // Act
        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        // Assert
        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, times(1)).insertAll(captor.capture());

        InsertAllRequest request = captor.getValue();
        assertEquals("f1_dataset", request.getTable().getDataset());
        assertEquals("telemetry", request.getTable().getTable());
        assertEquals(1, request.getRows().size());
    }
}
