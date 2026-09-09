package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.elysianarts.f1.visualizer.data.analysis.service.RaceAnalysisService;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AnalysisController.class)
@AutoConfigureMockMvc
@Import(F1VisualizerSecurityConfig.class)
class AnalysisControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private RaceAnalysisService raceAnalysisService;

    @MockitoBean private JwtDecoder jwtDecoder;

    @Test
    void getSessionLaps_ReturnsLaps_WhenAuthenticated() throws Exception {
        LapDataRecord mockLap =
                LapDataRecord.builder().driverNumber(1).lapNumber(5).lapDuration(85.5).build();
        when(raceAnalysisService.getSessionLapTimes(9165L)).thenReturn(List.of(mockLap));

        mockMvc.perform(
                        get("/api/v1/analysis/session/9165/laps")
                                .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].driverNumber").value(1))
                .andExpect(jsonPath("$[0].lapDuration").value(85.5));
    }

    @Test
    void getDriverStats_ReturnsStats_WhenAuthenticated() throws Exception {
        DriverProfile.DriverStats mockStats =
                DriverProfile.DriverStats.builder().speed(99).wins(50).build();
        when(raceAnalysisService.getDriverStats(1)).thenReturn(mockStats);

        mockMvc.perform(
                        get("/api/v1/analysis/drivers/1/stats")
                                .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.speed").value(99))
                .andExpect(jsonPath("$.wins").value(50));
    }

    /**
     * S5: analysis had no advice and let the exception escape the dispatcher. It now answers in the
     * same RFC 9457 shape as every other service, and the BigQuery client's message stays in the
     * log rather than reaching the browser.
     */
    @Test
    void getSessionLaps_Returns500ProblemDetail_WhenServiceThrows() throws Exception {
        when(raceAnalysisService.getSessionLapTimes(9165L))
                .thenThrow(
                        new RuntimeException(
                                "BigQuery connection failed for project f1-visualizer-488201"));

        mockMvc.perform(
                        get("/api/v1/analysis/session/9165/laps")
                                .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(jsonPath("$.detail").value(not(containsString("BigQuery"))));
    }

    @Test
    void getSessionLaps_ReturnsEmptyList_WhenNoDataExists() throws Exception {
        when(raceAnalysisService.getSessionLapTimes(9999L)).thenReturn(Collections.emptyList());

        mockMvc.perform(
                        get("/api/v1/analysis/session/9999/laps")
                                .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getSessionLaps_Returns401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/analysis/session/9165/laps"))
                .andExpect(status().isUnauthorized());
    }
}
