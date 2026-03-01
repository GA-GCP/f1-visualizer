package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayEngine {

    private final HistoricalRepository historicalRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private final List<OpenF1CarData> replayBuffer = new ArrayList<>();
    private boolean isRunning = false;
    private int currentIndex = 0;

    // NEW: Virtual Clock state
    private OffsetDateTime virtualClock;
    private static final long TICK_RATE_MS = 250;

    public void loadSession(long sessionKey) {
        this.isRunning = false;
        this.replayBuffer.clear();
        this.currentIndex = 0;

        List<OpenF1CarData> data = historicalRepository.fetchSessionTelemetry(sessionKey);
        this.replayBuffer.addAll(data);

        // Initialize clock to the very first packet's timestamp
        if (!this.replayBuffer.isEmpty()) {
            this.virtualClock = this.replayBuffer.get(0).getDate();
        }

        this.isRunning = true;
        log.info("Simulation loaded for session {}. Buffer size: {}", sessionKey, replayBuffer.size());
    }

    public void pause() {
        this.isRunning = false;
        log.info("Simulation paused at index {}", currentIndex);
    }

    public void play() {
        if (!replayBuffer.isEmpty() && currentIndex < replayBuffer.size()) {
            this.isRunning = true;
            log.info("Simulation playing from index {}", currentIndex);
        }
    }

    public void seek(int percentage) {
        if (replayBuffer.isEmpty()) return;

        int safePercentage = Math.max(0, Math.min(100, percentage));
        this.currentIndex = (int) ((safePercentage / 100.0) * (replayBuffer.size() - 1));

        // Sync the clock to the newly seeked position
        this.virtualClock = replayBuffer.get(this.currentIndex).getDate();
        log.info("Simulation seeked to {}% (Index: {})", safePercentage, currentIndex);
    }

    public void tick() {
        if (!isRunning || replayBuffer.isEmpty() || currentIndex >= replayBuffer.size()) return;

        // 1. Advance the virtual clock by exactly the interval it took for this tick to occur
        virtualClock = virtualClock.plus(TICK_RATE_MS, ChronoUnit.MILLIS);

        // 2. Poll all packets that occurred before or exactly at the current virtual clock
        while (currentIndex < replayBuffer.size() &&
                !replayBuffer.get(currentIndex).getDate().isAfter(virtualClock)) {

            OpenF1CarData packet = replayBuffer.get(currentIndex);
            redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
            currentIndex++;
        }

        // 3. Broadcast the current simulation progress as a percentage
        int progress = (int) (((double) currentIndex / replayBuffer.size()) * 100);
        redisTemplate.convertAndSend(RedisConfig.PLAYBACK_TOPIC, Map.of("progress", progress));

        if (currentIndex >= replayBuffer.size()) {
            log.info("Simulation finished. Pausing.");
            this.isRunning = false;
        }
    }
}