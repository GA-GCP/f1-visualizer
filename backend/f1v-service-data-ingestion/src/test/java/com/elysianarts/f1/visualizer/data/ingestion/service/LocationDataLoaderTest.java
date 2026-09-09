package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryProperties;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationDataLoaderTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private BigQueryBatchWriter batchWriter;

    @Mock
    private BigQueryQueryRunner queryRunner;

    private LocationDataLoader locationDataLoader;

    @BeforeEach
    void initLoader() {
        // C4: the dataset name is configuration now, not a constant per class.
        lenient().when(queryRunner.properties()).thenReturn(BigQueryProperties.defaults());
        // T2: the production 500 ms courtesy delay is configuration, not a
        // literal, so it does not run for real once per window in the suite.
        locationDataLoader = new LocationDataLoader(openF1Client, batchWriter, queryRunner, Duration.ZERO);
    }

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
        when(openF1Client.getSession(9165)).thenReturn(Optional.of(session));

        OpenF1LocationData packet = buildLocationPacket(9165, 1, 100, 200, 10);
        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(List.of(packet));

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        ArgumentCaptor<List<Map<String, Object>>> captor = ArgumentCaptor.captor();
        verify(batchWriter, atLeastOnce()).append(eq("f1_dataset"), eq("locations"), captor.capture());
        assertEquals(1, captor.getValue().size());
    }

    @Test
    void loadLocationsIntoBigQuery_SkipsIngestion_WhenSessionMetadataIsNull() {
        when(openF1Client.getSession(9999)).thenReturn(Optional.empty());

        locationDataLoader.loadLocationsIntoBigQuery(9999);

        verify(batchWriter, never()).append(any(), any(), any());
    }

    @Test
    void loadLocationsIntoBigQuery_SkipsIngestion_WhenDateStartIsNull() {
        OpenF1Session session = new OpenF1Session();
        session.setSessionKey(9999L);
        session.setDateStart(null);
        when(openF1Client.getSession(9999)).thenReturn(Optional.of(session));

        locationDataLoader.loadLocationsIntoBigQuery(9999);

        verify(batchWriter, never()).append(any(), any(), any());
    }

    @Test
    void loadLocationsIntoBigQuery_HandlesEmptyLocationData_Gracefully() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(10);

        OpenF1Session session = buildSession(9165, start, end);
        when(openF1Client.getSession(9165)).thenReturn(Optional.of(session));

        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(List.of());

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        verify(batchWriter, never()).append(any(), any(), any());
    }

    @Test
    void loadLocationsIntoBigQuery_UsesDefaultEndTime_WhenDateEndIsNull() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);

        OpenF1Session session = buildSession(9165, start, null);
        when(openF1Client.getSession(9165)).thenReturn(Optional.of(session));

        // The method should default to start + 2 hours when dateEnd is null
        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenReturn(List.of());

        locationDataLoader.loadLocationsIntoBigQuery(9165);

        // Verify it still ran (multiple 15-min windows would have been attempted)
        verify(openF1Client, atLeastOnce()).getLocationData(eq(9165L), any(), any());
    }

    @Test
    void loadLocationsIntoBigQuery_ContinuesOnWindowFetchError() {
        OffsetDateTime start = OffsetDateTime.of(2024, 3, 2, 15, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(10);

        OpenF1Session session = buildSession(9165, start, end);
        when(openF1Client.getSession(9165)).thenReturn(Optional.of(session));

        when(openF1Client.getLocationData(eq(9165L), any(), any()))
                .thenThrow(new RuntimeException("API timeout"));

        // Should not throw — errors are logged and the loop continues
        assertDoesNotThrow(() -> locationDataLoader.loadLocationsIntoBigQuery(9165));
    }
}
