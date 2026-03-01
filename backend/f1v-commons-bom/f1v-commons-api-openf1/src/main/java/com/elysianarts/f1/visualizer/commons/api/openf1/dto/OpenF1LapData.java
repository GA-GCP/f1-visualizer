package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class OpenF1LapData {
    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("driver_number")
    private Integer driverNumber;

    @JsonProperty("lap_number")
    private Integer lapNumber;

    @JsonProperty("lap_duration")
    private Double lapDuration;

    @JsonProperty("duration_sector_1")
    private Double sector1Duration;

    @JsonProperty("duration_sector_2")
    private Double sector2Duration;

    @JsonProperty("duration_sector_3")
    private Double sector3Duration;
}
