package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalLocationRepository;
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
    private final HistoricalLocationRepository historicalLocationRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private final List<OpenF1CarData> replayBuffer = new ArrayList<>();
    private final List<OpenF1LocationData> locationBuffer = new ArrayList<>();
    private final Object lock = new Object();
    private boolean isRunning = false;
    private int currentIndex = 0;
    private int locationIndex = 0;

    // Virtual Clock state
    private OffsetDateTime virtualClock;
    private static final long TICK_RATE_MS = 250;
    private static final int QUERY_LIMIT = 200_000;

    public void loadSession(long sessionKey) {
        synchronized (lock) {
            this.isRunning = false;
            this.replayBuffer.clear();
            this.locationBuffer.clear();
            this.currentIndex = 0;
            this.locationIndex = 0;

            List<OpenF1CarData> data = historicalRepository.fetchSessionTelemetry(sessionKey);
            this.replayBuffer.addAll(data);

            List<OpenF1LocationData> locData = historicalLocationRepository.fetchSessionLocations(sessionKey);
            this.locationBuffer.addAll(locData);

            if (data.size() == QUERY_LIMIT) {
                log.warn("Telemetry data may be truncated for session {}. Returned exactly {} rows.", sessionKey, QUERY_LIMIT);
            }
            if (locData.size() == QUERY_LIMIT) {
                log.warn("Location data may be truncated for session {}. Returned exactly {} rows.", sessionKey, QUERY_LIMIT);
            }

            // Initialize clock to the very first packet's timestamp
            if (!this.replayBuffer.isEmpty()) {
                this.virtualClock = this.replayBuffer.get(0).getDate();
            }

            this.isRunning = true;
            log.info("Simulation loaded for session {}. Telemetry: {}, Location: {}", sessionKey, replayBuffer.size(), locationBuffer.size());
        }
    }

    public void pause() {
        synchronized (lock) {
            this.isRunning = false;
            log.info("Simulation paused at index {}", currentIndex);
        }
    }

    public void play() {
        synchronized (lock) {
            if (!replayBuffer.isEmpty() && currentIndex < replayBuffer.size()) {
                this.isRunning = true;
                log.info("Simulation playing from index {}", currentIndex);
            }
        }
    }

    public void seek(int percentage) {
        synchronized (lock) {
            if (replayBuffer.isEmpty()) return;

            int safePercentage = Math.max(0, Math.min(100, percentage));
            this.currentIndex = (int) ((safePercentage / 100.0) * (replayBuffer.size() - 1));

            // Sync the clock to the newly seeked position
            this.virtualClock = replayBuffer.get(this.currentIndex).getDate();

            // Sync location index to match the new virtual clock
            this.locationIndex = 0;
            for (int i = 0; i < locationBuffer.size(); i++) {
                if (!locationBuffer.get(i).getDate().isAfter(virtualClock)) {
                    this.locationIndex = i + 1;
                } else {
                    break;
                }
            }

            log.info("Simulation seeked to {}% (Index: {}, LocIndex: {})", safePercentage, currentIndex, locationIndex);
        }
    }

    public void tick() {
        synchronized (lock) {
            if (!isRunning || replayBuffer.isEmpty() || currentIndex >= replayBuffer.size()) return;

            // 1. Advance the virtual clock by exactly the interval it took for this tick to occur
            virtualClock = virtualClock.plus(TICK_RATE_MS, ChronoUnit.MILLIS);

            // 2. Poll all telemetry packets that occurred before or exactly at the current virtual clock
            while (currentIndex < replayBuffer.size() &&
                    !replayBuffer.get(currentIndex).getDate().isAfter(virtualClock)) {

                OpenF1CarData packet = replayBuffer.get(currentIndex);
                redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
                currentIndex++;
            }

            // 3. Poll all location packets that occurred before or exactly at the current virtual clock
            while (locationIndex < locationBuffer.size() &&
                    !locationBuffer.get(locationIndex).getDate().isAfter(virtualClock)) {

                OpenF1LocationData locPacket = locationBuffer.get(locationIndex);
                redisTemplate.convertAndSend(RedisConfig.LOCATION_TOPIC, locPacket);
                locationIndex++;
            }

            // 4. Broadcast the current simulation progress as a percentage
            int progress = (int) (((double) currentIndex / replayBuffer.size()) * 100);
            redisTemplate.convertAndSend(RedisConfig.PLAYBACK_TOPIC, Map.of("progress", progress));

            if (currentIndex >= replayBuffer.size()) {
                log.info("Simulation finished. Pausing.");
                this.isRunning = false;
            }
        }
    }
}