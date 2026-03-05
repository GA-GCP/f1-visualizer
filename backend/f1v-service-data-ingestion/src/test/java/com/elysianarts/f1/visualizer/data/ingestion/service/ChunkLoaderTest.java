package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.data.ingestion.model.ReplayChunk;
import com.elysianarts.f1.visualizer.data.ingestion.model.SessionBounds;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalLocationRepository;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChunkLoaderTest {

    @Mock
    private HistoricalRepository historicalRepository;

    @Mock
    private HistoricalLocationRepository historicalLocationRepository;

    private ChunkLoader chunkLoader;

    @AfterEach
    void tearDown() {
        if (chunkLoader != null) {
            chunkLoader.shutdown();
        }
    }

    private ChunkLoader createChunkLoader() {
        chunkLoader = new ChunkLoader(historicalRepository, historicalLocationRepository);
        return chunkLoader;
    }

    @Test
    void fetchBounds_DelegatesToRepository() {
        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = OffsetDateTime.of(2023, 9, 17, 14, 0, 0, 0, ZoneOffset.UTC);
        SessionBounds expected = new SessionBounds(9165, start, end);
        when(historicalRepository.fetchTelemetryBounds(9165)).thenReturn(expected);

        ChunkLoader loader = createChunkLoader();
        SessionBounds result = loader.fetchBounds(9165);

        assertEquals(expected, result);
        verify(historicalRepository).fetchTelemetryBounds(9165);
    }

    @Test
    void fetchChunkSync_ReturnsCombinedChunk() {
        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        OpenF1CarData carData = new OpenF1CarData();
        carData.setSpeed(310);
        OpenF1LocationData locData = new OpenF1LocationData();
        locData.setX(1200);

        when(historicalRepository.fetchTelemetryWindow(9165, from, to)).thenReturn(List.of(carData));
        when(historicalLocationRepository.fetchLocationWindow(9165, from, to)).thenReturn(List.of(locData));

        ChunkLoader loader = createChunkLoader();
        ReplayChunk chunk = loader.fetchChunkSync(9165, from, to);

        assertFalse(chunk.isEmpty());
        assertEquals(1, chunk.telemetry().size());
        assertEquals(1, chunk.locations().size());
        assertEquals(310, chunk.telemetry().get(0).getSpeed());
        assertEquals(1200, chunk.locations().get(0).getX());
        assertEquals(from, chunk.chunkStartTime());
        assertEquals(to, chunk.chunkEndTime());
    }

    @Test
    void fetchChunkSync_ReturnsEmptyChunk_WhenNoData() {
        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        when(historicalRepository.fetchTelemetryWindow(9165, from, to)).thenReturn(List.of());
        when(historicalLocationRepository.fetchLocationWindow(9165, from, to)).thenReturn(List.of());

        ChunkLoader loader = createChunkLoader();
        ReplayChunk chunk = loader.fetchChunkSync(9165, from, to);

        assertTrue(chunk.isEmpty());
    }

    @Test
    void fetchChunkAsync_CompletesSuccessfully() throws Exception {
        OffsetDateTime from = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2023, 9, 17, 12, 1, 0, 0, ZoneOffset.UTC);

        OpenF1CarData carData = new OpenF1CarData();
        carData.setSpeed(280);

        when(historicalRepository.fetchTelemetryWindow(9165, from, to)).thenReturn(List.of(carData));
        when(historicalLocationRepository.fetchLocationWindow(9165, from, to)).thenReturn(List.of());

        ChunkLoader loader = createChunkLoader();
        ReplayChunk chunk = loader.fetchChunkAsync(9165, from, to).join();

        assertFalse(chunk.isEmpty());
        assertEquals(1, chunk.telemetry().size());
        assertEquals(280, chunk.telemetry().get(0).getSpeed());
    }
}
