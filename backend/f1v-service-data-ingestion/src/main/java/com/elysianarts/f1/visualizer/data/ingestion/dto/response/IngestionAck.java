package com.elysianarts.f1.visualizer.data.ingestion.dto.response;

/**
 * A typed acknowledgement, replacing the free-text bodies this controller used to return. Three
 * services returned three different shapes for the same idea, so a client could not handle any of
 * them uniformly (S5, C8).
 */
public record IngestionAck(String message) {}
