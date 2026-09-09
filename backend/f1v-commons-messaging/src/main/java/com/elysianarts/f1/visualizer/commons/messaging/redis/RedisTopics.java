package com.elysianarts.f1.visualizer.commons.messaging.redis;

/**
 * The channel names ingestion publishes on and telemetry subscribes to.
 *
 * <p>C4: these were declared twice, as constants on two near-identical {@code RedisConfig} classes
 * in two services — a producer/consumer contract where each side held its own copy of the names.
 */
public final class RedisTopics {

    public static final String TELEMETRY = "live_telemetry";
    public static final String LOCATION = "live_location";
    public static final String PLAYBACK_STATUS = "playback_status";

    private RedisTopics() {}
}
