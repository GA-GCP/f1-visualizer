package com.elysianarts.f1.visualizer.data.ingestion.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
public class OpenF1LocationData {

    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("date")
    private OffsetDateTime date;

    @JsonProperty("driver_number")
    private Integer driverNumber;

    @JsonProperty("x")
    private Integer x;

    @JsonProperty("y")
    private Integer y;

    @JsonProperty("z")
    private Integer z;
}