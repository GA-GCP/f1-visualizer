package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
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

    // Track timestamps separately
    private OffsetDateTime lastCarDataTime = null;
    private OffsetDateTime lastLocationTime = null;

    @Scheduled(fixedRate = 2000)
    public void ingestTelemetryLoop() {
        log.info("⚡ Cycle Start: Polling OpenF1 for Session {}...", TARGET_SESSION_KEY);

        // 1. Process Car Data (Physics)
        processCarData();

        // 2. Process Location Data (Coordinates)
        processLocationData();
    }

    private void processCarData() {
        List<OpenF1CarData> newPackets = openF1Client.getCarData(TARGET_SESSION_KEY, lastCarDataTime)
                .collectList().block();

        if (newPackets != null && !newPackets.isEmpty()) {
            log.info("   -> Received {} Car Data packets.", newPackets.size());
            for (OpenF1CarData packet : newPackets) {
                redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, packet);
            }
            newPackets.stream().max(Comparator.comparing(OpenF1CarData::getDate))
                    .ifPresent(latest -> this.lastCarDataTime = latest.getDate());
        }
    }

    private void processLocationData() {
        List<OpenF1LocationData> newPackets = openF1Client.getLocationData(TARGET_SESSION_KEY, lastLocationTime)
                .collectList().block();

        if (newPackets != null && !newPackets.isEmpty()) {
            log.info("   -> Received {} Location packets.", newPackets.size());
            for (OpenF1LocationData packet : newPackets) {
                redisTemplate.convertAndSend(RedisConfig.LOCATION_TOPIC, packet);
            }
            newPackets.stream().max(Comparator.comparing(OpenF1LocationData::getDate))
                    .ifPresent(latest -> this.lastLocationTime = latest.getDate());
        }
    }
}