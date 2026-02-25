package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.IngestionMode;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IngestionWorker {

    private final OpenF1Client openF1Client;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ReplayEngine replayEngine;
    private final LiveStreamService liveStreamService;

    private static final long TARGET_SESSION_KEY = 9165;

    // Singapore 2023 Race Start (approx 12:00 UTC)
    // We maintain a single "Game Clock" for the simulation
    private OffsetDateTime currentSimTime = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);

    // Default to SIMULATION for V1.0 Showcase
    private IngestionMode currentMode = IngestionMode.SIMULATION;

    // Live Polling State
    private static final long LIVE_SESSION_KEY = 9165; // Placeholder
    private OffsetDateTime currentLiveTime = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);

    // Run this once on startup to establish the connection if we are LIVE
    // @PostConstruct
    public void init() {
        if (currentMode == IngestionMode.LIVE) {
            liveStreamService.connect(LIVE_SESSION_KEY);
        }
    }

    @Scheduled(fixedRate = 250)
    public void runLoop() {
        // Only tick the Replay Engine.
        // The Live MQTT service runs on its own thread/callback system once connected.
        if (currentMode == IngestionMode.SIMULATION) {
            replayEngine.tick();
        }
    }

    public void startSimulation(long sessionKey) {
        log.info("Switching to SIMULATION mode for session {}", sessionKey);
        this.currentMode = IngestionMode.SIMULATION;
        replayEngine.loadSession(sessionKey);
    }

    public void startLiveStream(long sessionKey) {
        log.info("Switching to LIVE mode for session {}", sessionKey);
        this.currentMode = IngestionMode.LIVE;
        liveStreamService.connect(sessionKey);
    }


    public void ingestTelemetryLoop() {
        // Define a 2-second window (matching our poll rate)
        OffsetDateTime windowEnd = currentSimTime.plusSeconds(2);

        log.info("⚡ Simulating Race Time: {} to {}", currentSimTime, windowEnd);

        // 1. Fetch & Publish
        processCarData(windowEnd);
        processLocationData(windowEnd);

        // 2. Advance the Game Clock
        // We do this regardless of whether data was found, to skip over gaps (red flags, etc.)
        this.currentSimTime = windowEnd;
    }

    private void processCarData(OffsetDateTime windowEnd) {
        // Pass the explicit window (Start -> End)
        List<OpenF1CarData> packets = openF1Client.getCarData(TARGET_SESSION_KEY, currentSimTime, windowEnd)
                .collectList().block();

        if (packets != null && !packets.isEmpty()) {
            log.info("   -> [Telemetry] {} packets", packets.size());
            packets.forEach(p -> redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, p));
        }
    }

    private void processLocationData(OffsetDateTime windowEnd) {
        // Pass the explicit window (Start -> End)
        List<OpenF1LocationData> packets = openF1Client.getLocationData(TARGET_SESSION_KEY, currentSimTime, windowEnd)
                .collectList().block();

        if (packets != null && !packets.isEmpty()) {
            log.info("   -> [Location]  {} packets", packets.size());
            packets.forEach(p -> redisTemplate.convertAndSend(RedisConfig.LOCATION_TOPIC, p));
        }
    }
}