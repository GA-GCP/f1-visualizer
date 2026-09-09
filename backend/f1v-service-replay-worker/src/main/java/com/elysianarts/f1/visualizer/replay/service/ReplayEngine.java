package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.messaging.redis.RedisTopics;
import com.elysianarts.f1.visualizer.replay.model.ReplayChunk;
import com.elysianarts.f1.visualizer.replay.model.SessionBounds;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Replays historical telemetry and location data through Redis pub/sub using
 * a windowed buffer approach. Only the current chunk (plus a pre-fetched next chunk)
 * is held in memory at any time, preventing OOM on large sessions.
 *
 * <p><b>One message per channel per tick (P1).</b> Twenty cars at OpenF1's rates
 * is roughly 150 packets per 250 ms tick. Each used to be its own blocking Redis
 * round trip over the VPC connector, and the telemetry service then re-broadcast
 * each one as its own STOMP frame to every client — about 15,000 frames per tick
 * out of one instance at 100 viewers. The browser buffers in a ref and flushes
 * once per animation frame regardless, so per-packet delivery bought nothing.
 * A tick now publishes each channel's packets as a single JSON array: roughly
 * 100x fewer operations end to end, and the progress message goes out only when
 * the integer actually changes.</p>
 */
@Slf4j
@Service
public class ReplayEngine {

    private final ChunkLoader chunkLoader;
    private final RedisTemplate<String, Object> redisTemplate;

    // O2: nothing measured replay health, so a stalled or lagging replay was
    // invisible until someone watching it said so.
    private final Counter packetsPublished;
    private final Counter chunkStalls;
    private final Timer tickTimer;
    private final AtomicInteger progressGauge = new AtomicInteger();

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
    /** The last progress value published, so an unchanged integer costs nothing. */
    private int lastPublishedProgress = -1;

    public ReplayEngine(ChunkLoader chunkLoader,
                        RedisTemplate<String, Object> redisTemplate,
                        MeterRegistry meterRegistry) {
        this.chunkLoader = chunkLoader;
        this.redisTemplate = redisTemplate;
        this.packetsPublished = Counter.builder("f1v.replay.packets")
                .description("Telemetry and location packets published to Redis")
                .register(meterRegistry);
        this.chunkStalls = Counter.builder("f1v.replay.stalls")
                .description("Ticks that could not advance because the next chunk was not ready")
                .register(meterRegistry);
        this.tickTimer = Timer.builder("f1v.replay.tick")
                .description("Wall time spent in a single replay tick")
                .register(meterRegistry);
        meterRegistry.gauge("f1v.replay.progress", progressGauge);
    }

    public void loadSession(long sessionKey) {
        synchronized (lock) {
            this.isRunning = false;
            cancelPendingPrefetch();
            chunkLoader.evictAll();

            this.sessionKey = sessionKey;
            this.sessionBounds = chunkLoader.fetchBounds(sessionKey);

            if (sessionBounds == null || sessionBounds.isEmpty()) {
                log.warn("replay load skipped session_key={} reason=no_data", sessionKey);
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
            this.lastPublishedProgress = -1;
            this.isRunning = true;

            log.info("replay loaded session_key={} bounds=[{} -> {}] first_chunk_telemetry={} first_chunk_locations={}",
                sessionKey, sessionBounds.startTime(), sessionBounds.endTime(),
                currentChunk.telemetry().size(), currentChunk.locations().size());
        }
    }

    public void tick() {
        Timer.Sample sample = Timer.start();
        try {
            tickLocked();
        } finally {
            sample.stop(tickTimer);
        }
    }

    private void tickLocked() {
        synchronized (lock) {
            if (!isRunning || currentChunk.isEmpty() || sessionBounds == null) return;

            // 1. Advance the virtual clock
            virtualClock = virtualClock.plus(TICK_RATE_MS, ChronoUnit.MILLIS);

            // 2. If current chunk is exhausted and session not finished, swap to next
            if (isCurrentChunkExhausted() && !virtualClock.isAfter(sessionBounds.endTime())) {
                if (!trySwapToNextChunk()) {
                    // Next chunk not ready — stall by rolling back the clock advance
                    chunkStalls.increment();
                    log.warn("replay stalled virtual_clock={} reason=next_chunk_not_ready", virtualClock);
                    virtualClock = virtualClock.minus(TICK_RATE_MS, ChronoUnit.MILLIS);
                    return;
                }
            }

            // 3. Collect the telemetry packets due this tick
            List<OpenF1CarData> telemetry = currentChunk.telemetry();
            List<OpenF1CarData> telemetryBatch = new ArrayList<>();
            while (telemetryIndex < telemetry.size() &&
                   !telemetry.get(telemetryIndex).getDate().isAfter(virtualClock)) {
                telemetryBatch.add(telemetry.get(telemetryIndex));
                telemetryIndex++;
            }

            // 4. Collect the location packets due this tick
            List<OpenF1LocationData> locations = currentChunk.locations();
            List<OpenF1LocationData> locationBatch = new ArrayList<>();
            while (locationIndex < locations.size() &&
                   !locations.get(locationIndex).getDate().isAfter(virtualClock)) {
                locationBatch.add(locations.get(locationIndex));
                locationIndex++;
            }

            // 5. One PUBLISH per channel, and only for channels with something to say
            if (!telemetryBatch.isEmpty()) {
                redisTemplate.convertAndSend(RedisTopics.TELEMETRY, telemetryBatch);
                packetsPublished.increment(telemetryBatch.size());
            }
            if (!locationBatch.isEmpty()) {
                redisTemplate.convertAndSend(RedisTopics.LOCATION, locationBatch);
                packetsPublished.increment(locationBatch.size());
            }

            // 6. Progress is an integer percentage: at 250 ms ticks it repeats for
            //    dozens of ticks in a row, and a message per tick told the browser
            //    nothing it did not already know.
            publishProgressIfChanged();

            // 7. Trigger pre-fetch if needed
            maybeStartPrefetch();

            // 8. Check if session is finished
            if (!virtualClock.isBefore(sessionBounds.endTime()) && isCurrentChunkExhausted()) {
                log.info("replay finished session_key={}", sessionKey);
                this.isRunning = false;
            }
        }
    }

    private void publishProgressIfChanged() {
        int progress = calculateProgress();
        progressGauge.set(progress);
        if (progress != lastPublishedProgress) {
            lastPublishedProgress = progress;
            redisTemplate.convertAndSend(RedisTopics.PLAYBACK_STATUS, Map.of("progress", progress));
        }
    }

    /** What the worker publishes to Redis so any instance can answer a status query (R1). */
    public record Snapshot(Long sessionKey, OffsetDateTime virtualClock, boolean running, int progress) {}

    public Snapshot snapshot() {
        synchronized (lock) {
            return new Snapshot(
                    sessionBounds == null ? null : sessionKey,
                    virtualClock,
                    isRunning,
                    calculateProgress());
        }
    }

    public void pause() {
        synchronized (lock) {
            this.isRunning = false;
            log.info("replay paused virtual_clock={}", virtualClock);
        }
    }

    public void play() {
        synchronized (lock) {
            if (sessionBounds != null && !sessionBounds.isEmpty() &&
                virtualClock != null && virtualClock.isBefore(sessionBounds.endTime())) {
                this.isRunning = true;
                log.info("replay playing virtual_clock={}", virtualClock);
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

            // A scrub must reach the browser even when it lands on the same
            // integer percentage the previous tick already published.
            this.lastPublishedProgress = -1;
            publishProgressIfChanged();

            // Start loading the chunk after the seek target now rather than waiting
            // for playback to cross the prefetch threshold of the chunk it just
            // landed in — otherwise the first boundary after a scrub stalls (P6).
            startPrefetch();

            log.info("replay seek percentage={} time={} chunk=[{} -> {}] telemetry_index={} location_index={}",
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
        double chunkProgress = currentChunk.telemetry().isEmpty()
            ? 1.0
            : (double) telemetryIndex / currentChunk.telemetry().size();

        if (chunkProgress >= PREFETCH_THRESHOLD) {
            startPrefetch();
        }
    }

    /** Begins loading the chunk after the current one, unless there is nothing left to load. */
    private void startPrefetch() {
        if (pendingPrefetch != null) return;
        if (currentChunk.isEmpty() || currentChunk.chunkEndTime() == null) return;
        if (sessionBounds == null) return;

        // Don't prefetch if current chunk already covers session end
        if (!currentChunk.chunkEndTime().isBefore(sessionBounds.endTime())) return;

        OffsetDateTime nextStart = currentChunk.chunkEndTime().plusNanos(1000);
        OffsetDateTime nextEnd = calculateChunkEnd(nextStart);
        this.pendingPrefetch = chunkLoader.fetchChunkAsync(sessionKey, nextStart, nextEnd);
    }

    private boolean trySwapToNextChunk() {
        if (pendingPrefetch == null) {
            // No prefetch was triggered — synchronous fallback
            OffsetDateTime nextStart = currentChunk.chunkEndTime().plusNanos(1000);
            if (nextStart.isAfter(sessionBounds.endTime())) return false;
            OffsetDateTime nextEnd = calculateChunkEnd(nextStart);
            try {
                this.currentChunk = chunkLoader.fetchChunkSync(sessionKey, nextStart, nextEnd);
            } catch (RuntimeException e) {
                // R5: a BigQuery failure is a stall to retry on the next tick, not
                // the end of the session.
                log.error("replay chunk fetch failed session_key={}", sessionKey, e);
                return false;
            }
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
            log.error("replay chunk swap failed session_key={}", sessionKey, e);
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
