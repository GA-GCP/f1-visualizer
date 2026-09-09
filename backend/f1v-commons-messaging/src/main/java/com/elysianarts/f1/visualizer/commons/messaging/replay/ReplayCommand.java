package com.elysianarts.f1.visualizer.commons.messaging.replay;

import java.util.Map;

/**
 * An instruction for the replay worker (R1).
 *
 * <p>Playback used to be driven by calling the engine directly from an HTTP
 * handler, which only worked while the engine lived in the same JVM as the
 * handler — and Cloud Run was free to run five of them. Commands travel over a
 * Redis stream now, so the API can scale and exactly one worker acts on them.</p>
 */
public record ReplayCommand(Type type, Long sessionKey, Integer percentage) {

    public enum Type {
        /** Load a session and start replaying it from BigQuery. */
        LOAD_SIMULATION,
        /** Connect the MQTT bridge to a live session. */
        LOAD_LIVE,
        PLAY,
        PAUSE,
        SEEK
    }

    public static ReplayCommand loadSimulation(long sessionKey) {
        return new ReplayCommand(Type.LOAD_SIMULATION, sessionKey, null);
    }

    public static ReplayCommand loadLive(long sessionKey) {
        return new ReplayCommand(Type.LOAD_LIVE, sessionKey, null);
    }

    public static ReplayCommand play() {
        return new ReplayCommand(Type.PLAY, null, null);
    }

    public static ReplayCommand pause() {
        return new ReplayCommand(Type.PAUSE, null, null);
    }

    public static ReplayCommand seek(int percentage) {
        return new ReplayCommand(Type.SEEK, null, percentage);
    }

    /** Redis streams carry flat string fields, not nested objects. */
    public Map<String, String> toFields() {
        Map<String, String> fields = new java.util.HashMap<>();
        fields.put("type", type.name());
        if (sessionKey != null) fields.put("sessionKey", String.valueOf(sessionKey));
        if (percentage != null) fields.put("percentage", String.valueOf(percentage));
        return fields;
    }

    public static ReplayCommand fromFields(Map<String, String> fields) {
        String rawType = fields.get("type");
        if (rawType == null) {
            throw new IllegalArgumentException("Replay command has no type: " + fields);
        }
        String sessionKey = fields.get("sessionKey");
        String percentage = fields.get("percentage");
        return new ReplayCommand(
                Type.valueOf(rawType),
                sessionKey == null ? null : Long.parseLong(sessionKey),
                percentage == null ? null : Integer.parseInt(percentage));
    }
}
