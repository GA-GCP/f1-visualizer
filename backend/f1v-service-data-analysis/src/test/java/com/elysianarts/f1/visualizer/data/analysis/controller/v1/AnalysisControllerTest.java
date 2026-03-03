package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.commons.service.config.JacksonObjectMapperConfig;
import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.elysianarts.f1.visualizer.data.analysis.service.RaceAnalysisService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalysisController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class})
class AnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RaceAnalysisService raceAnalysisService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void getSessionLaps_ReturnsLaps_WhenAuthenticated() throws Exception {
        LapDataRecord mockLap = LapDataRecord.builder().driverNumber(1).lapNumber(5).lapDuration(85.5).build();
        when(raceAnalysisService.getSessionLapTimes(9165L)).thenReturn(List.of(mockLap));

        mockMvc.perform(get("/api/v1/analysis/session/9165/laps")
                        .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].driverNumber").value(1))
                .andExpect(jsonPath("$[0].lapDuration").value(85.5));
    }

    @Test
    void getDriverStats_ReturnsStats_WhenAuthenticated() throws Exception {
        DriverProfile.DriverStats mockStats = DriverProfile.DriverStats.builder().speed(99).wins(50).build();
        when(raceAnalysisService.getDriverStats(1)).thenReturn(mockStats);

        mockMvc.perform(get("/api/v1/analysis/drivers/1/stats")
                        .with(jwt().jwt(jwt -> jwt.subject("auth0|user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.speed").value(99))
                .andExpect(jsonPath("$.wins").value(50));
    }
}
