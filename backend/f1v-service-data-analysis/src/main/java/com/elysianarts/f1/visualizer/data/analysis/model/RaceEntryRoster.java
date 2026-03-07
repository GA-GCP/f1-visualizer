package com.elysianarts.f1.visualizer.data.analysis.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RaceEntryRoster {
    private long sessionKey;
    private int year;
    private List<SessionDriverEntry> drivers;
}
