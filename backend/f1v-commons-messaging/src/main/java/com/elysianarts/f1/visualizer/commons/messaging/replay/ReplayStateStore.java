package com.elysianarts.f1.visualizer.commons.messaging.replay;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/** Where the replay worker's state lives, so that it outlives the worker (R1). */
@Slf4j
@Component
public class ReplayStateStore {

    public static final String KEY = "f1v:replay:state";

    private final StringRedisTemplate redis;

    public ReplayStateStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void save(ReplayState state) {
        redis.opsForHash().putAll(KEY, state.toFields());
    }

    public ReplayState load() {
        try {
            Map<Object, Object> raw = redis.opsForHash().entries(KEY);
            if (raw.isEmpty()) {
                return ReplayState.idle();
            }
            Map<String, String> fields = new java.util.HashMap<>();
            raw.forEach((k, v) -> fields.put(String.valueOf(k), String.valueOf(v)));
            return ReplayState.fromFields(fields);
        } catch (RuntimeException e) {
            // A status query must not fail because Redis blinked.
            log.warn("replay state read failed — reporting idle", e);
            return ReplayState.idle();
        }
    }
}
