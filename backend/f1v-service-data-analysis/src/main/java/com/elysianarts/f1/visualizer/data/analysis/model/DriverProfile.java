package com.elysianarts.f1.visualizer.data.analysis.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DriverProfile {
    private int id;
    private String code;
    private String name;
    private String team;
    private String teamColor;
    private DriverStats stats;

    @Data
    @Builder
    public static class DriverStats {
        private int speed;
        private int consistency;
        private int aggression;
        private int tireMgmt;
        private int experience;
        private int wins;
        private int podiums;
        private int totalPoints;
        private int bestChampionshipFinish;
        private int totalRaces;
        @Builder.Default
        private List<String> teamsDrivenFor = List.of();
    }
}
