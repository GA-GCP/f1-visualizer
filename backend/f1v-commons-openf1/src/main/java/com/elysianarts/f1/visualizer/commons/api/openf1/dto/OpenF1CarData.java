package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import lombok.Data;
import lombok.NoArgsConstructor;

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

    // OpenF1 sends "n_gear"; the browser contract is "gear". Reading one and
    // writing the other is what an alias is for — the alternative was a Redis
    // mapper with all annotations switched off to defeat this single field (C5).
    @JsonProperty("gear")
    @JsonAlias("n_gear")
    private Integer gear;

    @JsonProperty("throttle")
    private Integer throttle;

    @JsonProperty("brake")
    private Integer brake;

    @JsonProperty("drs")
    private Integer drs;
}
