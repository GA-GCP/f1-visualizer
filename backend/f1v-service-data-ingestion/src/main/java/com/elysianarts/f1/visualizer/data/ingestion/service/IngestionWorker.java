package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IngestionWorker {

    private final OpenF1Client openF1Client;
    private final RedisTemplate<String, Object> redisTemplate;

    // Hardcoded Session ID for testing (Singapore 2023).
    // In the future, we would dynamically fetch the "latest/live" session key.
    private static final long TARGET_SESSION_KEY = 9165;

    // Track the timestamp of the last data point we processed to avoid duplicates
    private OffsetDateTime lastProcessedTime = null;

    @Scheduled(fixedRate = 2000) // Run every 2 seconds to respect API rate limits
    public void ingestTelemetryLoop() {
        log.info("⚡ Cycle Start: Polling OpenF1 for Session {}...", TARGET_SESSION_KEY);

        // 1. Fetch data from OpenF1
        List<OpenF1CarData> newPackets = openF1Client.getCarData(TARGET_SESSION_KEY, lastProcessedTime)
                .collectList()
                .block(); // Block here because we are inside a Scheduled thread, effectively acting synchronously

        if (newPackets == null || newPackets.isEmpty()) {
            log.info("   -> No new data found.");
            return;
        }

        log.info("   -> Received {} new telemetry packets.", newPackets.size());

        // 2. Publish each packet to Redis
        for (OpenF1CarData packet : newPackets) {
            redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
        }

        // 3. Update our high-water mark (timestamp) so next poll gets only newer data
        // We find the max date in the list we just received
        newPackets.stream()
                .max(Comparator.comparing(OpenF1CarData::getDate))
                .ifPresent(latest -> {
                    this.lastProcessedTime = latest.getDate();
                    log.info("   -> High-water mark updated to: {}", this.lastProcessedTime);
                });
    }
}
