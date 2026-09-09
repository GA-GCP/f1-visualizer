package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommand;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.stream.StreamListener;
import org.springframework.stereotype.Service;

/**
 * Applies commands from the Redis stream to the engine (R1).
 *
 * <p>These used to be direct method calls from an HTTP handler in the same JVM, which is the
 * coupling that forced the API and the engine to share a deployment.
 */
@Slf4j
@Service
public class ReplayCommandListener
        implements StreamListener<String, MapRecord<String, String, String>> {

    private final ReplayTicker ticker;

    public ReplayCommandListener(ReplayTicker ticker) {
        this.ticker = ticker;
    }

    @Override
    public void onMessage(MapRecord<String, String, String> record) {
        ReplayCommand command;
        try {
            command = ReplayCommandStream.parse(record);
        } catch (RuntimeException e) {
            // A malformed command is not worth stalling the stream over.
            log.error(
                    "replay command unparseable record_id={} fields={}",
                    record.getId(),
                    record.getValue(),
                    e);
            return;
        }

        log.info("replay command received type={} record_id={}", command.type(), record.getId());
        try {
            apply(command);
        } catch (RuntimeException e) {
            log.error(
                    "replay command failed type={} session_key={}",
                    command.type(),
                    command.sessionKey(),
                    e);
        }
    }

    private void apply(ReplayCommand command) {
        switch (command.type()) {
            case LOAD_SIMULATION -> ticker.startSimulation(command.sessionKey());
            case LOAD_LIVE -> ticker.startLiveStream(command.sessionKey());
            case PLAY -> ticker.play();
            case PAUSE -> ticker.pause();
            case SEEK -> ticker.seek(command.percentage());
        }
    }
}
