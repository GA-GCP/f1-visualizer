package com.elysianarts.f1.visualizer.data.analysis.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SessionDriverEntry {
    private int driverNumber;
    private String broadcastName;
    private String nameAcronym;
    private String teamName;
    private String teamColour; // hex without '#' prefix (e.g. "3671C6")
    private String countryCode;
}
