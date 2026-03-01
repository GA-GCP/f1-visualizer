package com.elysianarts.f1.visualizer.data.ingestion.controller.v1;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.SecretManagerConfig;
import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.commons.service.config.JacksonObjectMapperConfig;
import com.elysianarts.f1.visualizer.data.ingestion.service.HistoricalDataLoader;
import com.elysianarts.f1.visualizer.data.ingestion.service.IngestionWorker;
import com.elysianarts.f1.visualizer.data.ingestion.service.LapDataLoader;
import com.elysianarts.f1.visualizer.data.ingestion.service.ReplayEngine;
import com.google.cloud.bigquery.BigQuery;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IngestionController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class})
class IngestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IngestionWorker ingestionWorker;

    @MockitoBean
    private HistoricalDataLoader historicalDataLoader;

    @MockitoBean
    private ReplayEngine replayEngine;

    @MockitoBean
    private LapDataLoader lapDataLoader;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private BigQuery bigQuery;

    @MockitoBean
    private SecretManagerConfig.OpenF1Credentials openF1Credentials;

    @MockitoBean
    private RedisConnectionFactory redisConnectionFactory;

    @Test
    void pauseSimulation_CallsEngineAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/pause")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user"))))
                .andExpect(status().isOk())
                .andExpect(content().string("Simulation paused."));

        verify(replayEngine, times(1)).pause();
    }

    @Test
    void playSimulation_CallsEngineAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/play")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user"))))
                .andExpect(status().isOk())
                .andExpect(content().string("Simulation playing."));

        verify(replayEngine, times(1)).play();
    }

    @Test
    void seekSimulation_CallsEngineWithPercentage() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/seek")
                        .param("percentage", "75")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user"))))
                .andExpect(status().isOk())
                .andExpect(content().string("Simulation seeked to 75%"));

        verify(replayEngine, times(1)).seek(75);
    }
}