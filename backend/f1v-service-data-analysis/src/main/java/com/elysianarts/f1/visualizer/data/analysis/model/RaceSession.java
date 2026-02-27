package com.elysianarts.f1.visualizer.data.analysis.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RaceSession {
    private long sessionKey; // Using camelCase standard
    private String sessionName;
    private String meetingName;
    private int year;
    private String countryName;
}
