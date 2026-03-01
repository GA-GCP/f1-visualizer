package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayEngine {

    private final HistoricalRepository historicalRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    // In-Memory Buffer for the active simulation
    private final List<OpenF1CarData> replayBuffer = new ArrayList<>();
    private boolean isRunning = false;
    private int currentIndex = 0;

    public void loadSession(long sessionKey) {
        this.isRunning = false;
        this.replayBuffer.clear();
        this.currentIndex = 0;

        List<OpenF1CarData> data = historicalRepository.fetchSessionTelemetry(sessionKey);
        this.replayBuffer.addAll(data);

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

        // Ensure percentage is between 0 and 100
        int safePercentage = Math.max(0, Math.min(100, percentage));
        this.currentIndex = (int) ((safePercentage / 100.0) * (replayBuffer.size() - 1));
        log.info("Simulation seeked to {}% (Index: {})", safePercentage, currentIndex);
    }

    /**
     * Called by the main loop. Pushes the next set of packets.
     */
    public void tick() {
        if (!isRunning || replayBuffer.isEmpty() || currentIndex >= replayBuffer.size()) return;

        // V1.0 MVP: "burst" 5 packets per tick (approx realtime speed at 4Hz)
        int burstRate = 5;

        for (int i = 0; i < burstRate; i++) {
            if (currentIndex >= replayBuffer.size()) {
                log.info("Simulation finished. Pausing.");
                this.isRunning = false;
                break;
            }

            OpenF1CarData packet = replayBuffer.get(currentIndex);
            // Publish to the SAME topic the frontend listens to
            redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
            currentIndex++;
        }
    }
}