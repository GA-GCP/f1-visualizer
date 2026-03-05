package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.data.ingestion.model.ReplayChunk;
import com.elysianarts.f1.visualizer.data.ingestion.model.SessionBounds;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalLocationRepository;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Loads time-windowed chunks of replay data from BigQuery.
 * Owns a single-thread executor to serialize queries and support async pre-fetching.
 */
@Slf4j
@Service
public class ChunkLoader {

    private final HistoricalRepository historicalRepository;
    private final HistoricalLocationRepository historicalLocationRepository;
    private final ExecutorService executor;

    public ChunkLoader(HistoricalRepository historicalRepository,
                       HistoricalLocationRepository historicalLocationRepository) {
        this.historicalRepository = historicalRepository;
        this.historicalLocationRepository = historicalLocationRepository;
        this.executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "chunk-loader");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Fetches session time bounds synchronously. Lightweight aggregation query.
     */
    public SessionBounds fetchBounds(long sessionKey) {
        return historicalRepository.fetchTelemetryBounds(sessionKey);
    }

    /**
     * Fetches a chunk of data for the given time window synchronously.
     * Used for initial load and seek operations.
     */
    public ReplayChunk fetchChunkSync(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        log.debug("Fetching chunk sync [{} -> {}] for session {}", from, to, sessionKey);
        List<OpenF1CarData> telemetry = historicalRepository.fetchTelemetryWindow(sessionKey, from, to);
        List<OpenF1LocationData> locations = historicalLocationRepository.fetchLocationWindow(sessionKey, from, to);
        return new ReplayChunk(from, to,
            Collections.unmodifiableList(telemetry),
            Collections.unmodifiableList(locations));
    }

    /**
     * Fetches a chunk asynchronously on the dedicated executor.
     * Used for pre-fetching the next chunk during playback.
     */
    public CompletableFuture<ReplayChunk> fetchChunkAsync(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        log.debug("Triggering async prefetch [{} -> {}] for session {}", from, to, sessionKey);
        return CompletableFuture.supplyAsync(
            () -> fetchChunkSync(sessionKey, from, to),
            executor
        );
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }
}
