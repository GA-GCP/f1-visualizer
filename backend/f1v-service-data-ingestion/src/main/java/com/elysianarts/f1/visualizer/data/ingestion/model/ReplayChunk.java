package com.elysianarts.f1.visualizer.data.ingestion.model;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * A time-bounded chunk of replay data. Immutable once constructed.
 * Contains telemetry and location data for a specific time window.
 */
public record ReplayChunk(
    OffsetDateTime chunkStartTime,
    OffsetDateTime chunkEndTime,
    List<OpenF1CarData> telemetry,
    List<OpenF1LocationData> locations
) {
    /** Empty sentinel chunk used when no data is loaded. */
    public static final ReplayChunk EMPTY = new ReplayChunk(null, null, List.of(), List.of());

    public boolean isEmpty() {
        return telemetry.isEmpty() && locations.isEmpty();
    }
}
