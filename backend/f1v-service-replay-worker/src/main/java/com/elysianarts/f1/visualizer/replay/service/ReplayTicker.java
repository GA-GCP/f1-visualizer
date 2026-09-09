package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.constant.IngestionMode;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Drives the replay clock and publishes what it is doing (R1).
 *
 * <p>Mode used to be a field on this class in the same JVM as the HTTP handlers that set it. It is
 * written to Redis after every tick now, which is what lets any API instance answer a status query
 * and lets this worker resume the session it was replaying before a deploy restarted it.
 */
@Slf4j
@Service
public class ReplayTicker {

    private final ReplayEngine replayEngine;
    private final LiveStreamService liveStreamService;
    private final ReplayStateStore stateStore;

    private volatile IngestionMode currentMode = IngestionMode.SIMULATION;

    /** Redis is written once a second, not four times: the tick itself is the hot path. */
    private long lastStatePublishMillis;

    public ReplayTicker(
            ReplayEngine replayEngine,
            LiveStreamService liveStreamService,
            ReplayStateStore stateStore) {
        this.replayEngine = replayEngine;
        this.liveStreamService = liveStreamService;
        this.stateStore = stateStore;
    }

    @Scheduled(fixedRate = 250)
    public void runLoop() {
        // Only tick the Replay Engine.
        // The Live MQTT service runs on its own thread/callback system once connected.
        if (currentMode == IngestionMode.SIMULATION) {
            replayEngine.tick();
        }
        publishStateIfDue();
    }

    public void startSimulation(long sessionKey) {
        log.info("replay mode=SIMULATION session_key={}", sessionKey);
        this.currentMode = IngestionMode.SIMULATION;
        replayEngine.loadSession(sessionKey);
        publishState();
    }

    public void startLiveStream(long sessionKey) {
        log.info("replay mode=LIVE session_key={}", sessionKey);
        this.currentMode = IngestionMode.LIVE;
        liveStreamService.connect(sessionKey);
        publishState();
    }

    public void play() {
        replayEngine.play();
        publishState();
    }

    public void pause() {
        replayEngine.pause();
        publishState();
    }

    public void seek(int percentage) {
        replayEngine.seek(percentage);
        publishState();
    }

    /**
     * Picks up whatever this worker was replaying before it restarted. A deploy used to end the
     * session silently (R1).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void resumeFromLastKnownState() {
        ReplayState previous = stateStore.load();
        if (previous.mode() != ReplayState.Mode.SIMULATION || previous.sessionKey() == null) {
            log.info("replay worker started with nothing to resume mode={}", previous.mode());
            return;
        }

        log.info(
                "replay resuming session_key={} progress={} was_running={}",
                previous.sessionKey(),
                previous.progress(),
                previous.running());
        try {
            startSimulation(previous.sessionKey());
            if (previous.progress() > 0) {
                replayEngine.seek(previous.progress());
            }
            // Deliberately left paused: a viewer should press play, rather than
            // finding the session already moving after a deploy they did not see.
            replayEngine.pause();
            publishState();
        } catch (RuntimeException e) {
            log.error("replay resume failed session_key={}", previous.sessionKey(), e);
        }
    }

    private void publishStateIfDue() {
        long now = System.currentTimeMillis();
        if (now - lastStatePublishMillis < 1_000) return;
        lastStatePublishMillis = now;
        publishState();
    }

    void publishState() {
        try {
            ReplayEngine.Snapshot snapshot = replayEngine.snapshot();
            stateStore.save(
                    new ReplayState(
                            modeFor(snapshot),
                            snapshot.sessionKey(),
                            snapshot.virtualClock() == null
                                    ? null
                                    : snapshot.virtualClock().toString(),
                            snapshot.running(),
                            snapshot.progress(),
                            java.time.Instant.now().toString()));
        } catch (RuntimeException e) {
            // Losing a status update must not stop the replay it describes.
            log.warn("replay state publish failed", e);
        }
    }

    private ReplayState.Mode modeFor(ReplayEngine.Snapshot snapshot) {
        if (currentMode == IngestionMode.LIVE) return ReplayState.Mode.LIVE;
        return snapshot.sessionKey() == null ? ReplayState.Mode.IDLE : ReplayState.Mode.SIMULATION;
    }
}
