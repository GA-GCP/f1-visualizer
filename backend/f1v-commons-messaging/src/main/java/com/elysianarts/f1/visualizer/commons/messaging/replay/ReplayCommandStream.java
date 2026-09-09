package com.elysianarts.f1.visualizer.commons.messaging.replay;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * The command channel between the API and the replay worker (R1).
 *
 * <p>A stream rather than pub/sub: a command issued while the worker is
 * restarting — every deploy — would be dropped by pub/sub and is replayed from
 * the stream instead.</p>
 */
@Slf4j
@Component
public class ReplayCommandStream {

    public static final String KEY = "f1v:replay:commands";
    public static final String CONSUMER_GROUP = "replay-worker";

    /** Bounded: this is a command channel, not a log to keep. */
    private static final long MAX_LENGTH = 1_000;

    private final StringRedisTemplate redis;

    public ReplayCommandStream(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public RecordId publish(ReplayCommand command) {
        RecordId id = redis.opsForStream().add(StreamRecords.mapBacked(command.toFields()).withStreamKey(KEY));
        redis.opsForStream().trim(KEY, MAX_LENGTH, true);
        log.info("replay command published type={} session_key={} record_id={}",
                command.type(), command.sessionKey(), id);
        return id;
    }

    public static ReplayCommand parse(MapRecord<String, String, String> record) {
        return ReplayCommand.fromFields(record.getValue());
    }
}
