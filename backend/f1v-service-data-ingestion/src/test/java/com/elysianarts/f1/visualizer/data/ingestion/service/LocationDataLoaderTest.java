package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQuery bigQuery;

    @InjectMocks
    private LocationDataLoader locationDataLoader;

    private OpenF1Session buildSession(long key, OffsetDateTime start, OffsetDateTime end) {
        OpenF1Session session = new OpenF1Session();
        session.setSessionKey(key);
        session.setDateStart(start);
        session.setDateEnd(end);
        return session;
    }

    private OpenF1LocationData buildLocationPacket(long sessionKey, int driverNumber, int x, int y, int z) {
        OpenF1LocationData packet = new OpenF1LocationData();
        packet.setSessionKey(sessionKey);
        packet.setMeetingKey(1219L);
        packet.setDate(OffsetDateTime.of(2024, 3, 2, 15, 10, 0, 0, ZoneOffset.UTC));
        packet.setDriverNumber(driverNumber);
        packet.setX(x);
        packet.setY(y);
        packet.setZ(z);
        return packet;
    }

    @Test
    void loadLocationsIntoBigQuery_FetchesAndInserts_WhenDataAvailable() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(10); // Short race for fast test

        OpenF1Session session = buildSession(9165, start, end);
        when(openF1Client.getSession(9165)).thenReturn(Mono.just(session));

        OpenF1LocationData packet = buildLocationPacket(9165, 1, 100, 200, 10);
        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(Flux.just(packet));

        InsertAllResponse response = mock(InsertAllResponse.class);
        when(response.hasErrors()).thenReturn(false);
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(response);

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        ArgumentCaptor<InsertAllRequest> captor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, atLeastOnce()).insertAll(captor.capture());

        InsertAllRequest captured = captor.getValue();
        assertEquals("f1_dataset", captured.getTable().getDataset());
        assertEquals("locations", captured.getTable().getTable());
    }

    @Test
    void loadLocationsIntoBigQuery_SkipsIngestion_WhenSessionMetadataIsNull() {
        when(openF1Client.getSession(9999)).thenReturn(Mono.empty());

        locationDataLoader.loadLocationsIntoBigQuery(9999);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadLocationsIntoBigQuery_SkipsIngestion_WhenDateStartIsNull() {
        OpenF1Session session = new OpenF1Session();
        session.setSessionKey(9999L);
        session.setDateStart(null);
        when(openF1Client.getSession(9999)).thenReturn(Mono.just(session));

        locationDataLoader.loadLocationsIntoBigQuery(9999);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadLocationsIntoBigQuery_HandlesEmptyLocationData_Gracefully() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(10);

        OpenF1Session session = buildSession(9165, start, end);
        when(openF1Client.getSession(9165)).thenReturn(Mono.just(session));

        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(Flux.empty());

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        verify(bigQuery, never()).insertAll(any(InsertAllRequest.class));
    }

    @Test
    void loadLocationsIntoBigQuery_UsesDefaultEndTime_WhenDateEndIsNull() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);

        OpenF1Session session = buildSession(9165, start, null);
        when(openF1Client.getSession(9165)).thenReturn(Mono.just(session));

        // The method should default to start + 2 hours when dateEnd is null
        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(Flux.empty());

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        // Verify it still ran (multiple 15-min windows would have been attempted)
        verify(openF1Client, atLeastOnce()).getLocationData(eq(9165L), any(), any());
    }

    @Test
    void loadLocationsIntoBigQuery_ContinuesOnWindowFetchError() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(10);

        OpenF1Session session = buildSession(9165, start, end);
        when(openF1Client.getSession(9165)).thenReturn(Mono.just(session));

        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenThrow(new RuntimeException("API timeout"));

        // Should not throw — errors are logged and the loop continues
        assertDoesNotThrow(() -> locationDataLoader.loadLocationsIntoBigQuery(9165));
    }
}
