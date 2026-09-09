package com.elysianarts.f1.visualizer.commons.api.openf1.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A driver as OpenF1 reports them, for a session or for the current grid.
 *
 * <p>C4: the reference loader used to hand-roll these requests and read the responses as untyped
 * {@code Map}s, alongside a typed client that already existed for every other endpoint.
 */
@Data
@NoArgsConstructor
public class OpenF1Driver {
    @JsonProperty("session_key")
    private Long sessionKey;

    @JsonProperty("driver_number")
    private Integer driverNumber;

    @JsonProperty("broadcast_name")
    private String broadcastName;

    @JsonProperty("name_acronym")
    private String nameAcronym;

    @JsonProperty("team_name")
    private String teamName;

    @JsonProperty("team_colour")
    private String teamColour;

    @JsonProperty("country_code")
    private String countryCode;
}
