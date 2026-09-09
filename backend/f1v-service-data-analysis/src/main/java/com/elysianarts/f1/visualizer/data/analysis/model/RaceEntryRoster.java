package com.elysianarts.f1.visualizer.data.analysis.model;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RaceEntryRoster {
    private long sessionKey;
    private int year;
    private List<SessionDriverEntry> drivers;
}
