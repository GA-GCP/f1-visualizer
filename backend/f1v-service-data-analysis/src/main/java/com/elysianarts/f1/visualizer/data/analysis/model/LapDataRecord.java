package com.elysianarts.f1.visualizer.data.analysis.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LapDataRecord {
    private int driverNumber;
    private int lapNumber;
    private Double lapDuration; // In seconds (e.g., 84.123)
    private Double sector1;
    private Double sector2;
    private Double sector3;
    private String compound; // e.g., "SOFT", "HARD"
    private String dateStart; // ISO-8601 timestamp from BigQuery
    private Boolean isPitOutLap;
}
