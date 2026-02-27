package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.model.constant.IngestionMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class IngestionWorker {

    private final ReplayEngine replayEngine;
    private final LiveStreamService liveStreamService;

    private IngestionMode currentMode = IngestionMode.SIMULATION;

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
}