package com.elysianarts.f1.visualizer.data.ingestion.controller.v1;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.OpenF1CredentialsConfig;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommand;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.data.ingestion.config.IngestionSecurityConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.IngestionJob;
import com.elysianarts.f1.visualizer.data.ingestion.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IngestionController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, IngestionSecurityConfig.class})
class IngestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HistoricalDataLoader historicalDataLoader;

    @MockitoBean
    private ReferenceDataLoader referenceDataLoader;

    @MockitoBean
    private ReplayCommandStream commandStream;

    @MockitoBean
    private ReplayStateStore stateStore;

    @MockitoBean
    private LapDataLoader lapDataLoader;

    @MockitoBean
    private ResultDataLoader resultDataLoader;

    @MockitoBean
    private LocationDataLoader locationDataLoader;

    @MockitoBean
    private DriverStatsPrecomputer driverStatsPrecomputer;

    @MockitoBean
    private IngestionJobService jobService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private OpenF1CredentialsConfig.OpenF1Credentials openF1Credentials;

    @MockitoBean
    private RedisConnectionFactory redisConnectionFactory;

    /** A signed-in viewer: authenticated, but holding no administrative permission. */
    private static RequestPostProcessor viewer() {
        return jwt().jwt(jwt -> jwt.subject("viewer_user"));
    }

    /** A token carrying the Auth0 permission the loaders require (S1). */
    private static RequestPostProcessor admin() {
        return jwt().jwt(jwt -> jwt.subject("admin_user"))
                .authorities(new SimpleGrantedAuthority(IngestionSecurityConfig.INGEST_ADMIN));
    }

    // ── Playback: open to any authenticated user, because it is the product ──

    @Test
    void pauseSimulation_CallsEngineAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/pause").with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Simulation paused."));

        verify(commandStream).publish(ReplayCommand.pause());
    }

    @Test
    void playSimulation_CallsEngineAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/play").with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Simulation playing."));

        verify(commandStream).publish(ReplayCommand.play());
    }

    @Test
    void seekSimulation_CallsEngineWithPercentage() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/seek").param("percentage", "75").with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Simulation seeked to 75%"));

        verify(commandStream).publish(ReplayCommand.seek(75));
    }

    @Test
    void seekSimulation_Returns400_WhenPercentageOutOfRange() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/playback/seek").param("percentage", "150").with(viewer()))
                .andExpect(status().isBadRequest());

        verify(commandStream, never()).publish(any());
    }

    // ── Administrative endpoints ──

    @Test
    void command_Returns401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/command")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SIMULATION\",\"sessionKey\":9165}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * S1: this is the finding. Any signed-in user could switch the global
     * ingestion mode, and delete and rewrite the BigQuery reference tables.
     */
    @Test
    void command_Returns403_WhenCallerLacksIngestAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/command")
                        .with(viewer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SIMULATION\",\"sessionKey\":9165}"))
                .andExpect(status().isForbidden());

        verify(commandStream, never()).publish(any());
    }

    @Test
    void loadReference_Returns403_WhenCallerLacksIngestAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/load-reference").param("year", "2023").with(viewer()))
                .andExpect(status().isForbidden());

        verify(jobService, never()).submit(any(), any(), any());
    }

    @Test
    void loadHistorical_Returns403_WhenCallerLacksIngestAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/load-historical").param("sessionKey", "9165").with(viewer()))
                .andExpect(status().isForbidden());

        verify(jobService, never()).submit(any(), any(), any());
    }

    @Test
    void command_StartsSimulation_WhenModeIsSimulation() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/command")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SIMULATION\",\"sessionKey\":9165}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Simulation initiated for session 9165"));

        verify(commandStream).publish(ReplayCommand.loadSimulation(9165L));
    }

    @Test
    void command_StartsLiveStream_WhenModeIsLive() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/command")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"LIVE\",\"sessionKey\":9165}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Live stream initiated for session 9165"));

        verify(commandStream).publish(ReplayCommand.loadLive(9165L));
    }

    /** C8: Bean Validation, not a hand-written null check returning free text. */
    @Test
    void command_Returns400ProblemDetail_WhenSessionKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/command")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SIMULATION\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verify(commandStream, never()).publish(any());
    }

    // ── R3: loads are jobs, not requests ──

    @Test
    void loadHistorical_Returns202WithAJob() throws Exception {
        IngestionJob job = IngestionJob.accepted(IngestionJob.Type.HISTORICAL, "9165");
        when(jobService.submit(eq(IngestionJob.Type.HISTORICAL), eq("9165"), any())).thenReturn(job);

        mockMvc.perform(post("/api/v1/ingestion/load-historical").param("sessionKey", "9165").with(admin()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").value(job.id()))
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void loadReference_Returns202WithAJob() throws Exception {
        IngestionJob job = IngestionJob.accepted(IngestionJob.Type.REFERENCE, "2024");
        when(jobService.submit(eq(IngestionJob.Type.REFERENCE), eq("2024"), any())).thenReturn(job);

        mockMvc.perform(post("/api/v1/ingestion/load-reference").param("year", "2024").with(admin()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.type").value("REFERENCE"));
    }

    /** C8: the old default of 2023 silently loaded the wrong season. */
    @Test
    void loadReference_Returns400_WhenYearIsMissing() throws Exception {
        mockMvc.perform(post("/api/v1/ingestion/load-reference").with(admin()))
                .andExpect(status().isBadRequest());

        verify(jobService, never()).submit(any(), any(), any());
    }

    @Test
    void getJob_ReturnsTheJob_WhenItExists() throws Exception {
        IngestionJob job = IngestionJob.accepted(IngestionJob.Type.HISTORICAL, "9165")
                .to(IngestionJob.Status.SUCCEEDED, "Completed in 42s");
        when(jobService.find(job.id())).thenReturn(Optional.of(job));

        mockMvc.perform(get("/api/v1/ingestion/jobs/" + job.id()).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.detail").value("Completed in 42s"));
    }

    /** R1: the answer used to live in one instance's memory, unreachable from any other. */
    @Test
    void playbackStatus_ReportsWhatTheWorkerIsDoing() throws Exception {
        when(stateStore.load()).thenReturn(
                new ReplayState(ReplayState.Mode.SIMULATION, 9165L, "2023-09-17T12:34:56Z", true, 42, null));

        mockMvc.perform(get("/api/v1/ingestion/playback/status").with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("SIMULATION"))
                .andExpect(jsonPath("$.sessionKey").value(9165))
                .andExpect(jsonPath("$.progress").value(42))
                .andExpect(jsonPath("$.running").value(true));
    }

    @Test
    void getJob_Returns404_WhenUnknown() throws Exception {
        when(jobService.find("nope")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/ingestion/jobs/nope").with(admin()))
                .andExpect(status().isNotFound());
    }
}
