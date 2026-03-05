package com.elysianarts.f1.visualizer.data.ingestion.model;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Immutable time bounds for a historical session.
 * Used to calculate time-based progress and chunk boundaries.
 */
public record SessionBounds(
    long sessionKey,
    OffsetDateTime startTime,
    OffsetDateTime endTime
) {
    public boolean isEmpty() {
        return startTime == null || endTime == null;
    }

    public long durationMillis() {
        if (isEmpty()) return 0;
        return Duration.between(startTime, endTime).toMillis();
    }
}
