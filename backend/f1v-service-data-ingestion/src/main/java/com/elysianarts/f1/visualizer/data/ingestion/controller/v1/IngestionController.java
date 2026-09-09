package com.elysianarts.f1.visualizer.data.ingestion.controller.v1;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.constant.IngestionMode;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommand;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import com.elysianarts.f1.visualizer.data.ingestion.dto.request.IngestionCommandRequest;
import com.elysianarts.f1.visualizer.data.ingestion.dto.response.IngestionAck;
import com.elysianarts.f1.visualizer.data.ingestion.model.IngestionJob;
import com.elysianarts.f1.visualizer.data.ingestion.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;

/**
 * The ingestion API.
 *
 * <p><b>R1: stateless.</b> This controller used to call the replay engine's
 * methods directly, which only worked while the engine was a singleton in the
 * same JVM — and Cloud Run runs several. Playback commands go onto a Redis stream
 * for the replay worker to pick up, and status is read from Redis, so any
 * instance can serve any request.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ingestion")
@RequiredArgsConstructor
public class IngestionController {

    private final HistoricalDataLoader historicalDataLoader;
    private final ReferenceDataLoader referenceDataLoader;
    private final LapDataLoader lapDataLoader;
    private final ResultDataLoader resultDataLoader;
    private final LocationDataLoader locationDataLoader;
    private final DriverStatsPrecomputer driverStatsPrecomputer;
    private final IngestionJobService jobService;
    private final ReplayCommandStream commandStream;
    private final ReplayStateStore stateStore;

    @PostMapping("/command")
    public ResponseEntity<IngestionAck> issueIngestionCommand(@Valid @RequestBody IngestionCommandRequest request) {
        log.info("ingestion command mode={} session_key={}", request.getMode(), request.getSessionKey());

        ReplayCommand command = request.getMode() == IngestionMode.SIMULATION
                ? ReplayCommand.loadSimulation(request.getSessionKey())
                : ReplayCommand.loadLive(request.getSessionKey());
        commandStream.publish(command);

        String what = request.getMode() == IngestionMode.SIMULATION ? "Simulation" : "Live stream";
        return ResponseEntity.ok(new IngestionAck(what + " initiated for session " + request.getSessionKey()));
    }

    /**
     * R3: 202 with a job id, not a 504 with the work still running. Four loaders
     * plus the stats recompute is minutes of work, well past the gateway's
     * deadline.
     */
    @PostMapping("/load-historical")
    public ResponseEntity<IngestionJob> loadHistoricalData(@RequestParam Long sessionKey) {
        IngestionJob job = jobService.submit(
                IngestionJob.Type.HISTORICAL,
                String.valueOf(sessionKey),
                () -> {
                    historicalDataLoader.loadSessionIntoBigQuery(sessionKey);
                    lapDataLoader.loadLapsIntoBigQuery(sessionKey);
                    resultDataLoader.loadResultsIntoBigQuery(sessionKey);
                    locationDataLoader.loadLocationsIntoBigQuery(sessionKey);
                    // P2: the load is what changes the inputs, so it is what
                    // recomputes the answers.
                    driverStatsPrecomputer.recompute();
                });
        return accepted(job);
    }

    @PostMapping("/load-reference")
    public ResponseEntity<IngestionJob> loadReferenceData(
            // C8: the previous default of 2023 silently loaded the wrong season
            // for anyone who forgot the parameter.
            @RequestParam @Min(1950) @Max(2100) int year) {
        IngestionJob job = jobService.submit(
                IngestionJob.Type.REFERENCE,
                String.valueOf(year),
                () -> referenceDataLoader.loadReferenceData(year));
        return accepted(job);
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<IngestionJob> getJob(@PathVariable String jobId) {
        return jobService.find(jobId)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such ingestion job"));
    }

    // ── Playback ──

    @PostMapping("/playback/pause")
    public ResponseEntity<IngestionAck> pauseSimulation() {
        commandStream.publish(ReplayCommand.pause());
        return ResponseEntity.ok(new IngestionAck("Simulation paused."));
    }

    @PostMapping("/playback/play")
    public ResponseEntity<IngestionAck> playSimulation() {
        commandStream.publish(ReplayCommand.play());
        return ResponseEntity.ok(new IngestionAck("Simulation playing."));
    }

    @PostMapping("/playback/seek")
    public ResponseEntity<IngestionAck> seekSimulation(@RequestParam @Min(0) @Max(100) int percentage) {
        commandStream.publish(ReplayCommand.seek(percentage));
        return ResponseEntity.ok(new IngestionAck("Simulation seeked to " + percentage + "%"));
    }

    /**
     * R1: what the worker is doing, read from Redis. There was previously no way
     * to ask — the answer lived in one instance's memory, and the instance that
     * received the question was usually not that one.
     */
    @GetMapping("/playback/status")
    public ResponseEntity<ReplayState> playbackStatus() {
        return ResponseEntity.ok(stateStore.load());
    }

    private static ResponseEntity<IngestionJob> accepted(IngestionJob job) {
        return ResponseEntity
                .accepted()
                .location(URI.create("/api/v1/ingestion/jobs/" + job.id()))
                .body(job);
    }
}
