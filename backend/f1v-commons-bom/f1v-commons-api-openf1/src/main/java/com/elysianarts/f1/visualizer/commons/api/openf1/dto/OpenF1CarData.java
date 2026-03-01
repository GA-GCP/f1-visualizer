package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
public class OpenF1CarData {
    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("date")
    private OffsetDateTime date;

    @JsonProperty("driver_number")
    private Integer driverNumber;

    @JsonProperty("speed")
    private Integer speed;

    @JsonProperty("rpm")
    private Integer rpm;

    @JsonProperty("gear")
    private Integer gear;

    @JsonProperty("throttle")
    private Integer throttle;

    @JsonProperty("brake")
    private Integer brake;

    @JsonProperty("drs")
    private Integer drs;
}

