package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class OpenF1StintData {
    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("stint_number")
    private Integer stintNumber;

    @JsonProperty("driver_number")
    private Integer driverNumber;

    @JsonProperty("lap_start")
    private Integer lapStart;

    @JsonProperty("lap_end")
    private Integer lapEnd;

    @JsonProperty("compound")
    private String compound;

    @JsonProperty("tyre_age_at_start")
    private Integer tyreAgeAtStart;
}
