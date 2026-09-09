package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A race weekend. The /sessions endpoint does not carry meeting_name; this does. */
@Data
@NoArgsConstructor
public class OpenF1Meeting {
    @JsonProperty("meeting_key")
    private Long meetingKey;

    @JsonProperty("meeting_name")
    private String meetingName;

    @JsonProperty("year")
    private Integer year;
}
