package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.ReplayChunk;
import com.elysianarts.f1.visualizer.data.ingestion.model.SessionBounds;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Replays historical telemetry and location data through Redis pub/sub using
 * a windowed buffer approach. Only the current chunk (plus a pre-fetched next chunk)
 * is held in memory at any time, preventing OOM on large sessions.
 */
@Slf4j
@Service
public class ReplayEngine {

    private final ChunkLoader chunkLoader;
    private final RedisTemplate<String, Object> redisTemplate;

    // Session metadata
    private long sessionKey;
    private SessionBounds sessionBounds;

    // Chunk configuration
    static final long CHUNK_DURATION_SECONDS = 60;
    private static final double PREFETCH_THRESHOLD = 0.5;
    private static final long TICK_RATE_MS = 250;

    // Current chunk state
    private ReplayChunk currentChunk = ReplayChunk.EMPTY;
    private int telemetryIndex = 0;
    private int locationIndex = 0;

    // Pre-fetch state
    private volatile CompletableFuture<ReplayChunk> pendingPrefetch = null;

    // Playback state
    private final Object lock = new Object();
    private boolean isRunning = false;
    private OffsetDateTime virtualClock;

    public ReplayEngine(ChunkLoader chunkLoader, RedisTemplate<String, Object> redisTemplate) {
        this.chunkLoader = chunkLoader;
        this.redisTemplate = redisTemplate;
    }

    public void loadSession(long sessionKey) {
        synchronized (lock) {
            this.isRunning = false;
            cancelPendingPrefetch();

            this.sessionKey = sessionKey;
            this.sessionBounds = chunkLoader.fetchBounds(sessionKey);

            if (sessionBounds == null || sessionBounds.isEmpty()) {
                log.warn("No data found for session {}. Nothing to replay.", sessionKey);
                this.currentChunk = ReplayChunk.EMPTY;
                this.telemetryIndex = 0;
                this.locationIndex = 0;
                this.virtualClock = null;
                return;
            }

            OffsetDateTime chunkEnd = calculateChunkEnd(sessionBounds.startTime());
            this.currentChunk = chunkLoader.fetchChunkSync(sessionKey, sessionBounds.startTime(), chunkEnd);
            this.telemetryIndex = 0;
            this.locationIndex = 0;
            this.virtualClock = sessionBounds.startTime();
            this.isRunning = true;

            log.info("Simulation loaded for session {}. Bounds: [{} -> {}]. First chunk: {} telemetry, {} location rows",
                sessionKey, sessionBounds.startTime(), sessionBounds.endTime(),
                currentChunk.telemetry().size(), currentChunk.locations().size());
        }
    }

    public void tick() {
        synchronized (lock) {
            if (!isRunning || currentChunk.isEmpty() || sessionBounds == null) return;

            // 1. Advance the virtual clock
            virtualClock = virtualClock.plus(TICK_RATE_MS, ChronoUnit.MILLIS);

            // 2. If current chunk is exhausted and session not finished, swap to next
            if (isCurrentChunkExhausted() && !virtualClock.isAfter(sessionBounds.endTime())) {
                if (!trySwapToNextChunk()) {
                    // Next chunk not ready — stall by rolling back the clock advance
                    log.warn("Chunk stall: next chunk not yet available at {}", virtualClock);
                    virtualClock = virtualClock.minus(TICK_RATE_MS, ChronoUnit.MILLIS);
                    return;
                }
            }

            // 3. Emit telemetry packets up to virtualClock
            List<OpenF1CarData> telemetry = currentChunk.telemetry();
            while (telemetryIndex < telemetry.size() &&
                   !telemetry.get(telemetryIndex).getDate().isAfter(virtualClock)) {
                redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, telemetry.get(telemetryIndex));
                telemetryIndex++;
            }

            // 4. Emit location packets up to virtualClock
            List<OpenF1LocationData> locations = currentChunk.locations();
            while (locationIndex < locations.size() &&
                   !locations.get(locationIndex).getDate().isAfter(virtualClock)) {
                redisTemplate.convertAndSend(RedisConfig.LOCATION_TOPIC, locations.get(locationIndex));
                locationIndex++;
            }

            // 5. Broadcast time-based progress
            int progress = calculateProgress();
            redisTemplate.convertAndSend(RedisConfig.PLAYBACK_TOPIC, Map.of("progress", progress));

            // 6. Trigger pre-fetch if needed
            maybeStartPrefetch();

            // 7. Check if session is finished
            if (!virtualClock.isBefore(sessionBounds.endTime()) && isCurrentChunkExhausted()) {
                log.info("Simulation finished. Pausing.");
                this.isRunning = false;
            }
        }
    }

    public void pause() {
        synchronized (lock) {
            this.isRunning = false;
            log.info("Simulation paused at {}", virtualClock);
        }
    }

    public void play() {
        synchronized (lock) {
            if (sessionBounds != null && !sessionBounds.isEmpty() &&
                virtualClock != null && virtualClock.isBefore(sessionBounds.endTime())) {
                this.isRunning = true;
                log.info("Simulation playing from {}", virtualClock);
            }
        }
    }

    public void seek(int percentage) {
        synchronized (lock) {
            if (sessionBounds == null || sessionBounds.isEmpty()) return;

            int safePercentage = Math.max(0, Math.min(100, percentage));
            cancelPendingPrefetch();

            // Calculate target time from percentage
            long totalDurationMs = sessionBounds.durationMillis();
            long targetOffsetMs = (totalDurationMs * safePercentage) / 100;
            OffsetDateTime targetTime = sessionBounds.startTime().plus(targetOffsetMs, ChronoUnit.MILLIS);

            // Calculate aligned chunk boundaries
            long sessionOffsetSeconds = Duration.between(sessionBounds.startTime(), targetTime).getSeconds();
            long chunkNumber = sessionOffsetSeconds / CHUNK_DURATION_SECONDS;
            OffsetDateTime chunkStart = sessionBounds.startTime().plusSeconds(chunkNumber * CHUNK_DURATION_SECONDS);
            OffsetDateTime chunkEnd = calculateChunkEnd(chunkStart);

            // Load target chunk synchronously
            this.currentChunk = chunkLoader.fetchChunkSync(sessionKey, chunkStart, chunkEnd);
            this.virtualClock = targetTime;

            // Position telemetryIndex past all packets at or before targetTime
            this.telemetryIndex = 0;
            for (int i = 0; i < currentChunk.telemetry().size(); i++) {
                if (!currentChunk.telemetry().get(i).getDate().isAfter(targetTime)) {
                    this.telemetryIndex = i + 1;
                } else {
                    break;
                }
            }

            // Position locationIndex the same way
            this.locationIndex = 0;
            for (int i = 0; i < currentChunk.locations().size(); i++) {
                if (!currentChunk.locations().get(i).getDate().isAfter(targetTime)) {
                    this.locationIndex = i + 1;
                } else {
                    break;
                }
            }

            log.info("Seeked to {}% (time: {}, chunk: [{} -> {}], telIdx: {}, locIdx: {})",
                safePercentage, targetTime, chunkStart, chunkEnd, telemetryIndex, locationIndex);
        }
    }

    private OffsetDateTime calculateChunkEnd(OffsetDateTime chunkStart) {
        OffsetDateTime candidate = chunkStart.plusSeconds(CHUNK_DURATION_SECONDS);
        if (sessionBounds != null && candidate.isAfter(sessionBounds.endTime())) {
            return sessionBounds.endTime();
        }
        return candidate;
    }

    private boolean isCurrentChunkExhausted() {
        return telemetryIndex >= currentChunk.telemetry().size() &&
               locationIndex >= currentChunk.locations().size();
    }

    private void maybeStartPrefetch() {
        if (pendingPrefetch != null) return;
        if (currentChunk.isEmpty() || currentChunk.chunkEndTime() == null) return;
        if (sessionBounds == null) return;

        // Don't prefetch if current chunk already covers session end
        if (!currentChunk.chunkEndTime().isBefore(sessionBounds.endTime())) return;

        double chunkProgress = currentChunk.telemetry().isEmpty()
            ? 1.0
            : (double) telemetryIndex / currentChunk.telemetry().size();

        if (chunkProgress >= PREFETCH_THRESHOLD) {
            OffsetDateTime nextStart = currentChunk.chunkEndTime().plusNanos(1000);
            OffsetDateTime nextEnd = calculateChunkEnd(nextStart);
            this.pendingPrefetch = chunkLoader.fetchChunkAsync(sessionKey, nextStart, nextEnd);
        }
    }

    private boolean trySwapToNextChunk() {
        if (pendingPrefetch == null) {
            // No prefetch was triggered — synchronous fallback
            OffsetDateTime nextStart = currentChunk.chunkEndTime().plusNanos(1000);
            if (nextStart.isAfter(sessionBounds.endTime())) return false;
            OffsetDateTime nextEnd = calculateChunkEnd(nextStart);
            this.currentChunk = chunkLoader.fetchChunkSync(sessionKey, nextStart, nextEnd);
            this.telemetryIndex = 0;
            this.locationIndex = 0;
            return !currentChunk.isEmpty();
        }

        if (!pendingPrefetch.isDone()) {
            return false; // not ready yet
        }

        try {
            ReplayChunk nextChunk = pendingPrefetch.join();
            this.pendingPrefetch = null;
            if (nextChunk.isEmpty()) return false;
            this.currentChunk = nextChunk;
            this.telemetryIndex = 0;
            this.locationIndex = 0;
            return true;
        } catch (Exception e) {
            log.error("Failed to swap to next chunk", e);
            this.pendingPrefetch = null;
            return false;
        }
    }

    int calculateProgress() {
        if (sessionBounds == null || sessionBounds.isEmpty()) return 0;
        long totalDurationMs = sessionBounds.durationMillis();
        if (totalDurationMs <= 0) return 100;
        long elapsedMs = Duration.between(sessionBounds.startTime(), virtualClock).toMillis();
        return (int) Math.min(100, Math.max(0, (elapsedMs * 100) / totalDurationMs));
    }

    private void cancelPendingPrefetch() {
        CompletableFuture<ReplayChunk> pending = this.pendingPrefetch;
        if (pending != null) {
            pending.cancel(true);
            this.pendingPrefetch = null;
        }
    }
}
