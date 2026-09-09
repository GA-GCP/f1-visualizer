package com.elysianarts.f1.visualizer.commons.messaging.replay;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * What the replay worker is currently doing (R1).
 *
 * <p>Mode, session and virtual clock used to be fields on a singleton in one
 * JVM's memory: no other instance could answer a status query, and a restart —
 * every deploy — silently discarded the replay. Held in Redis, any instance can
 * report it and a restarted worker can pick the session back up where it left
 * off.</p>
 */
public record ReplayState(
        Mode mode,
        Long sessionKey,
        String virtualClock,
        boolean running,
        int progress,
        String updatedAt) {

    public enum Mode { IDLE, SIMULATION, LIVE }

    public static ReplayState idle() {
        return new ReplayState(Mode.IDLE, null, null, false, 0, Instant.now().toString());
    }

    public Map<String, String> toFields() {
        Map<String, String> fields = new HashMap<>();
        fields.put("mode", mode.name());
        if (sessionKey != null) fields.put("sessionKey", String.valueOf(sessionKey));
        if (virtualClock != null) fields.put("virtualClock", virtualClock);
        fields.put("running", String.valueOf(running));
        fields.put("progress", String.valueOf(progress));
        fields.put("updatedAt", updatedAt == null ? Instant.now().toString() : updatedAt);
        return fields;
    }

    public static ReplayState fromFields(Map<String, String> fields) {
        if (fields == null || fields.isEmpty() || fields.get("mode") == null) {
            return idle();
        }
        String sessionKey = fields.get("sessionKey");
        return new ReplayState(
                Mode.valueOf(fields.get("mode")),
                sessionKey == null ? null : Long.parseLong(sessionKey),
                fields.get("virtualClock"),
                Boolean.parseBoolean(fields.getOrDefault("running", "false")),
                Integer.parseInt(fields.getOrDefault("progress", "0")),
                fields.get("updatedAt"));
    }
}
