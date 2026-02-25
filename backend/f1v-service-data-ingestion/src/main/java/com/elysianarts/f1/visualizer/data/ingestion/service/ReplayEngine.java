package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayEngine {

    private final HistoricalRepository historicalRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    // In-Memory Buffer for the active simulation
    private final Queue<OpenF1CarData> replayBuffer = new LinkedList<>();
    private boolean isRunning = false;

    public void loadSession(long sessionKey) {
        this.isRunning = false;
        this.replayBuffer.clear();

        List<OpenF1CarData> data = historicalRepository.fetchSessionTelemetry(sessionKey);
        this.replayBuffer.addAll(data);

        this.isRunning = true;
        log.info("Simulation loaded for session {}. Buffer size: {}", sessionKey, replayBuffer.size());
    }

    /**
     * Called by the main loop. Pops the next set of packets "due" for the current timeframe.
     */
    public void tick() {
        if (!isRunning || replayBuffer.isEmpty()) return;

        // In a real sophisticated engine, we would check timestamps.
        // For V1.0 MVP, we "burst" 5 packets per tick (approx realtime speed at 4Hz)
        int burstRate = 5;

        for (int i = 0; i < burstRate; i++) {
            OpenF1CarData packet = replayBuffer.poll();
            if (packet == null) break;

            // Publish to the SAME topic the frontend listens to
            redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
        }

        if (replayBuffer.isEmpty()) {
            log.info("Simulation finished. Restarting loop...");
            // Optional: loop indefinitely?
            // isRunning = false;
        }
    }
}
