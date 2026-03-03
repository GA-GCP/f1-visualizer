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
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    @Test
    void loadSessionIntoBigQuery_ReturnsEarly_WhenSessionMetaIsNull() {
        when(openF1Client.getSession(9165L)).thenReturn(Mono.empty());

        historicalDataLoader.loadSessionIntoBigQuery(9165L);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadSessionIntoBigQuery_FallbacksTo2HourWindow_WhenDateEndIsNull() {
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(null); // No end date

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));
        when(openF1Client.getCarData(eq(sessionKey), any(), any())).thenReturn(Flux.empty());

        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        // With a 2-hour window in 15-minute chunks, getCarData should be called 8 times
        verify(openF1Client, times(8)).getCarData(eq(sessionKey), any(), any());
    }

    @Test
    void loadSessionIntoBigQuery_FlushesPartialBatch_WhenDataLessThanBatchSize() {
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime endTime = startTime.plusMinutes(10);

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(endTime);

        // Create just 3 packets (well below BATCH_SIZE of 500)
        OpenF1CarData pkt1 = new OpenF1CarData();
        pkt1.setSessionKey(sessionKey);
        pkt1.setDriverNumber(1);
        pkt1.setSpeed(300);
        pkt1.setDate(startTime.plusMinutes(1));

        OpenF1CarData pkt2 = new OpenF1CarData();
        pkt2.setSessionKey(sessionKey);
        pkt2.setDriverNumber(44);
        pkt2.setSpeed(305);
        pkt2.setDate(startTime.plusMinutes(2));

        OpenF1CarData pkt3 = new OpenF1CarData();
        pkt3.setSessionKey(sessionKey);
        pkt3.setDriverNumber(16);
        pkt3.setSpeed(310);
        pkt3.setDate(startTime.plusMinutes(3));

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));
        when(openF1Client.getCarData(eq(sessionKey), any(), any())).thenReturn(Flux.just(pkt1, pkt2, pkt3));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        // The partial batch of 3 should still be flushed
        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, atLeastOnce()).insertAll(captor.capture());

        InsertAllRequest request = captor.getValue();
        assertEquals(3, request.getRows().size());
    }

    @Test
    void loadSessionIntoBigQuery_LogsBigQueryErrors_WhenResponseHasErrors() {
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime endTime = startTime.plusMinutes(10);

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(endTime);

        OpenF1CarData mockCarData = new OpenF1CarData();
        mockCarData.setSessionKey(sessionKey);
        mockCarData.setDriverNumber(1);
        mockCarData.setSpeed(300);
        mockCarData.setDate(startTime.plusMinutes(1));

        InsertAllResponse errorResponse = mock(InsertAllResponse.class);
        when(errorResponse.hasErrors()).thenReturn(true);
        when(errorResponse.getInsertErrors()).thenReturn(Collections.emptyMap());

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));
        when(openF1Client.getCarData(eq(sessionKey), any(), any())).thenReturn(Flux.just(mockCarData));
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(errorResponse);

        // Should not throw - just logs errors
        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        verify(bigQuery, atLeastOnce()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadSessionIntoBigQuery_HandlesEmptyApiResponse_WithoutInsert() {
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime endTime = startTime.plusMinutes(10);

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(endTime);

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));
        when(openF1Client.getCarData(eq(sessionKey), any(), any())).thenReturn(Flux.empty());

        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadSessionIntoBigQuery_ContinuesToNextWindow_WhenOneFails() {
        long sessionKey = 9165L;
        OffsetDateTime startTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime endTime = startTime.plusMinutes(30); // 2 windows: 0-15, 15-30

        OpenF1Session mockSession = new OpenF1Session();
        mockSession.setDateStart(startTime);
        mockSession.setDateEnd(endTime);

        OpenF1CarData mockCarData = new OpenF1CarData();
        mockCarData.setSessionKey(sessionKey);
        mockCarData.setDriverNumber(1);
        mockCarData.setSpeed(300);
        mockCarData.setDate(startTime.plusMinutes(16));

        when(openF1Client.getSession(sessionKey)).thenReturn(Mono.just(mockSession));

        // First window throws, second window succeeds
        when(openF1Client.getCarData(eq(sessionKey), any(), any()))
                .thenThrow(new RuntimeException("API Error"))
                .thenReturn(Flux.just(mockCarData));

        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);

        // Despite first window failing, second window should still process
        verify(openF1Client, times(2)).getCarData(eq(sessionKey), any(), any());
        verify(bigQuery, times(1)).insertAll(any(InsertAllRequest.class));
    }
}
