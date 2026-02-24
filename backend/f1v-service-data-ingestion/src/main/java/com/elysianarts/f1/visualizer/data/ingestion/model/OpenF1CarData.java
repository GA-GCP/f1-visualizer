package com.elysianarts.f1.visualizer.data.ingestion.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
public class OpenF1CarData {

    // OpenF1 API returns snake_case JSON (e.g., "driver_number")
    // We map it to CamelCase Java fields.

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
