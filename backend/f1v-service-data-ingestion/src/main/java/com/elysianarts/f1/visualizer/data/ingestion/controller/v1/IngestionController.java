package com.elysianarts.f1.visualizer.data.ingestion.controller.v1;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.constant.IngestionMode;
import com.elysianarts.f1.visualizer.data.ingestion.dto.request.IngestionCommandRequest;
import com.elysianarts.f1.visualizer.data.ingestion.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/ingestion")
@RequiredArgsConstructor
public class IngestionController {
    private final IngestionWorker ingestionWorker;
    private final HistoricalDataLoader historicalDataLoader;
    private final ReferenceDataLoader referenceDataLoader;
    private final ReplayEngine replayEngine;
    private final LapDataLoader lapDataLoader;
    private final ResultDataLoader resultDataLoader;
    private final LocationDataLoader locationDataLoader;

    @PostMapping("/command")
    public ResponseEntity<String> issueIngestionCommand(@RequestBody IngestionCommandRequest request) {
        log.info("Received Ingestion Command: Mode={}, SessionKey={}", request.getMode(), request.getSessionKey());
        if (request.getSessionKey() == null) {
            return ResponseEntity.badRequest().body("sessionKey is required.");
        }
        if (request.getMode() == IngestionMode.SIMULATION) {
            ingestionWorker.startSimulation(request.getSessionKey());
            return ResponseEntity.ok("Simulation initiated for session: " + request.getSessionKey());
        }
        if (request.getMode() == IngestionMode.LIVE) {
            try {
                ingestionWorker.startLiveStream(request.getSessionKey());
            } catch (Exception e) {
                log.error("Live stream connection failed for session: {}", request.getSessionKey(), e);
                return ResponseEntity.status(502).body("Failed to connect to live data feed: " + e.getMessage());
            }
            return ResponseEntity.ok("Live stream connection initiated for session: " + request.getSessionKey());
        }
        return ResponseEntity.badRequest().body("Invalid ingestion mode.");
    }

    @PostMapping("/load-historical")
    public ResponseEntity<String> loadHistoricalData(@RequestParam Long sessionKey) {
        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);
        lapDataLoader.loadLapsIntoBigQuery(sessionKey);
        resultDataLoader.loadResultsIntoBigQuery(sessionKey);
        locationDataLoader.loadLocationsIntoBigQuery(sessionKey);

        return ResponseEntity.ok("Batch ingestion started for session: " + sessionKey);
    }

    @PostMapping("/load-reference")
    public ResponseEntity<String> loadReferenceData(@RequestParam(defaultValue = "2023") int year) {
        referenceDataLoader.loadReferenceData(year);
        return ResponseEntity.ok("Reference data hydration triggered for year " + year);
    }

    @PostMapping("/playback/pause")
    public ResponseEntity<String> pauseSimulation() {
        replayEngine.pause();
        return ResponseEntity.ok("Simulation paused.");
    }

    @PostMapping("/playback/play")
    public ResponseEntity<String> playSimulation() {
        replayEngine.play();
        return ResponseEntity.ok("Simulation playing.");
    }

    @PostMapping("/playback/seek")
    public ResponseEntity<String> seekSimulation(@RequestParam int percentage) {
        replayEngine.seek(percentage);
        return ResponseEntity.ok("Simulation seeked to " + percentage + "%");
    }
}