package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.commons.service.config.JacksonObjectMapperConfig;
import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.service.ReferenceDataService;
import com.google.cloud.bigquery.BigQuery;
import org.junit.jupiter.api.BeforeEach;
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

@WebMvcTest(ReferenceDataController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class})
class ReferenceDataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReferenceDataService referenceDataService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private BigQuery bigQuery;

    private DriverProfile mockDriver;
    private RaceSession mockSession;

    @BeforeEach
    void setUp() {
        mockDriver = DriverProfile.builder()
                .id(1)
                .code("VER")
                .name("Max Verstappen")
                .team("Red Bull Racing")
                .teamColor("#3671C6")
                .stats(DriverProfile.DriverStats.builder().speed(99).wins(54).build())
                .build();

        mockSession = RaceSession.builder()
                .sessionKey(9165)
                .sessionName("Race")
                .meetingName("Singapore Grand Prix")
                .year(2023)
                .build();
    }

    @Test
    void getDrivers_ReturnsListOfDrivers_With200Ok() throws Exception {
        // Arrange
        when(referenceDataService.getMasterDriverList()).thenReturn(List.of(mockDriver));

        // Act & Assert
        mockMvc.perform(get("/api/v1/analysis/drivers")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].code").value("VER"))
                .andExpect(jsonPath("$[0].stats.speed").value(99));
    }

    @Test
    void getSessions_ReturnsListOfSessions_With200Ok() throws Exception {
        // Arrange
        when(referenceDataService.getAvailableSessions()).thenReturn(List.of(mockSession));

        // Act & Assert
        mockMvc.perform(get("/api/v1/analysis/sessions")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sessionKey").value(9165))
                .andExpect(jsonPath("$[0].meetingName").value("Singapore Grand Prix"));
    }

    @Test
    void endpoints_Return401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/analysis/drivers"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/analysis/sessions"))
                .andExpect(status().isUnauthorized());
    }
}
