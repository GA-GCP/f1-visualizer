package com.elysianarts.f1.visualizer.data.ingestion.model;

public enum IngestionMode {
    LIVE,       // Polls OpenF1 API (Real-time)
    SIMULATION  // Replays BigQuery Data (Historical)
}
