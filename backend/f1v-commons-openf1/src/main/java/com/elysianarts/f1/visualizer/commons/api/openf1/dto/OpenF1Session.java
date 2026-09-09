package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
public class OpenF1Session {
    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("date_start")
    private OffsetDateTime dateStart;

    @JsonProperty("date_end")
    private OffsetDateTime dateEnd;

    // C4: the reference loader read these out of an untyped Map.
    @JsonProperty("session_name")
    private String sessionName;

    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("year")
    private Integer year;

    @JsonProperty("country_name")
    private String countryName;
}

