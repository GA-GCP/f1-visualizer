package com.elysianarts.f1.visualizer.data.ingestion.controller;

import com.elysianarts.f1.visualizer.data.ingestion.model.constant.IngestionMode;
import com.elysianarts.f1.visualizer.data.ingestion.model.request.IngestionCommandRequest;
import com.elysianarts.f1.visualizer.data.ingestion.service.HistoricalDataLoader;
import com.elysianarts.f1.visualizer.data.ingestion.service.IngestionWorker;
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
            ingestionWorker.startLiveStream(request.getSessionKey());
            return ResponseEntity.ok("Live stream connection initiated for session: " + request.getSessionKey());
        }

        return ResponseEntity.badRequest().body("Invalid ingestion mode.");
    }

    @PostMapping("/load-historical")
    public ResponseEntity<String> loadHistoricalData(@RequestParam Long sessionKey) {
        // Kicks off the @Async batch job
        historicalDataLoader.loadSessionIntoBigQuery(sessionKey);
        return ResponseEntity.ok("Batch ingestion started in the background for session: " + sessionKey);
    }
}
