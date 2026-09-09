package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.replay.model.ReplayChunk;
import com.elysianarts.f1.visualizer.replay.model.SessionBounds;
import com.elysianarts.f1.visualizer.replay.repository.HistoricalLocationRepository;
import com.elysianarts.f1.visualizer.replay.repository.HistoricalRepository;
import jakarta.annotation.PreDestroy;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Loads time-windowed chunks of replay data from BigQuery.
 *
 * <p>Owns a small executor for async pre-fetching and an LRU of recently played chunks. The LRU is
 * what makes scrubbing backwards instant: without it every seek was a fresh synchronous BigQuery
 * round trip of one to three seconds, even back into the window the viewer had just watched (P6).
 */
@Slf4j
@Service
public class ChunkLoader {

    /** Two 60-second windows either side of the current one. */
    private static final int CACHE_CAPACITY = 4;

    private final HistoricalRepository historicalRepository;
    private final HistoricalLocationRepository historicalLocationRepository;
    private final ExecutorService executor;

    /**
     * R9: two threads, not one. {@code CompletableFuture.cancel(true)} never interrupts the running
     * BigQuery call, so on a single-thread executor the prefetch issued after a seek queued behind
     * the chunk the seek had just abandoned. A second thread lets the new work start while the
     * stale query drains; its result is discarded by the engine, which only ever reads the future
     * it is currently holding.
     */
    private static final int PREFETCH_THREADS = 2;

    private final Map<ChunkKey, ReplayChunk> recentChunks =
            Collections.synchronizedMap(
                    new LinkedHashMap<>(CACHE_CAPACITY + 1, 0.75f, true) {
                        @Override
                        protected boolean removeEldestEntry(
                                Map.Entry<ChunkKey, ReplayChunk> eldest) {
                            return size() > CACHE_CAPACITY;
                        }
                    });

    private record ChunkKey(long sessionKey, OffsetDateTime from, OffsetDateTime to) {}

    public ChunkLoader(
            HistoricalRepository historicalRepository,
            HistoricalLocationRepository historicalLocationRepository) {
        this.historicalRepository = historicalRepository;
        this.historicalLocationRepository = historicalLocationRepository;
        AtomicInteger threadNumber = new AtomicInteger();
        this.executor =
                Executors.newFixedThreadPool(
                        PREFETCH_THREADS,
                        r -> {
                            Thread t =
                                    new Thread(r, "chunk-loader-" + threadNumber.incrementAndGet());
                            t.setDaemon(true);
                            return t;
                        });
    }

    /** Fetches session time bounds synchronously. Lightweight aggregation query. */
    public SessionBounds fetchBounds(long sessionKey) {
        return historicalRepository.fetchTelemetryBounds(sessionKey);
    }

    /**
     * Fetches a chunk of data for the given time window synchronously. Used for initial load and
     * seek operations.
     */
    public ReplayChunk fetchChunkSync(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        ChunkKey key = new ChunkKey(sessionKey, from, to);
        ReplayChunk cached = recentChunks.get(key);
        if (cached != null) {
            log.debug("chunk cache hit session_key={} from={} to={}", sessionKey, from, to);
            return cached;
        }

        log.debug("chunk fetch session_key={} from={} to={}", sessionKey, from, to);
        List<OpenF1CarData> telemetry =
                historicalRepository.fetchTelemetryWindow(sessionKey, from, to);
        List<OpenF1LocationData> locations =
                historicalLocationRepository.fetchLocationWindow(sessionKey, from, to);
        ReplayChunk chunk =
                new ReplayChunk(
                        from,
                        to,
                        Collections.unmodifiableList(telemetry),
                        Collections.unmodifiableList(locations));

        if (!chunk.isEmpty()) {
            recentChunks.put(key, chunk);
        }
        return chunk;
    }

    /**
     * Fetches a chunk asynchronously on the dedicated executor. Used for pre-fetching the next
     * chunk during playback.
     */
    public CompletableFuture<ReplayChunk> fetchChunkAsync(
            long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        log.debug("chunk prefetch session_key={} from={} to={}", sessionKey, from, to);
        return CompletableFuture.supplyAsync(() -> fetchChunkSync(sessionKey, from, to), executor);
    }

    /**
     * Dropped when a different session is loaded, so a re-ingested session is not replayed stale.
     */
    public void evictAll() {
        recentChunks.clear();
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }
}
