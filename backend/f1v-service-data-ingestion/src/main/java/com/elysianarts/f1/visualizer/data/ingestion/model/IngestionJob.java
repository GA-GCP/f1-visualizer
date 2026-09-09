package com.elysianarts.f1.visualizer.data.ingestion.model;

import java.time.Instant;
import java.util.UUID;

/**
 * A long-running ingestion request and its outcome (R3).
 *
 * <p>{@code POST /load-historical} used to run four loaders inline, two of which sleep 500 ms per
 * fifteen-minute window: a two-hour session is eight windows across two loaders, plus laps and
 * results — comfortably past the gateway's 120 s deadline and Cloud Run's 300 s request timeout.
 * The caller received a 504 while the work carried on unobserved, throttled by the platform. The
 * request now returns this, and the work runs behind it.
 */
public record IngestionJob(
        String id,
        Type type,
        String target,
        Status status,
        Instant createdAt,
        Instant updatedAt,
        String detail) {
    public enum Type {
        HISTORICAL,
        REFERENCE
    }

    public enum Status {
        ACCEPTED,
        RUNNING,
        SUCCEEDED,
        FAILED;

        public boolean isTerminal() {
            return this == SUCCEEDED || this == FAILED;
        }
    }

    public static IngestionJob accepted(Type type, String target) {
        Instant now = Instant.now();
        return new IngestionJob(
                UUID.randomUUID().toString(), type, target, Status.ACCEPTED, now, now, null);
    }

    public IngestionJob to(Status next, String detail) {
        return new IngestionJob(id, type, target, next, createdAt, Instant.now(), detail);
    }
}
