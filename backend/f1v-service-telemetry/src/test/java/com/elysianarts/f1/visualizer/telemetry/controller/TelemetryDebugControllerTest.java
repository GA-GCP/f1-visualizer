package com.elysianarts.f1.visualizer.telemetry.controller;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.telemetry.config.JacksonObjectMapperConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer; // Import added
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TelemetryDebugController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class})
class TelemetryDebugControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RedisTemplate<String, Object> redisTemplate;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "redisContainer")
    private RedisMessageListenerContainer redisContainer;

    @Test
    void publishManualTelemetry_PublishesToRedis_WhenAuthorized() throws Exception {
        // Arrange
        Map<String, Object> payload = new HashMap<>();
        payload.put("driver", "HAM");
        payload.put("speed", 290);

        String expectedTopic = "live_telemetry";

        // When
        when(redisTemplate.convertAndSend(eq(expectedTopic), any(Map.class)))
                .thenReturn(1L);

        // Act & Assert
        mockMvc.perform(post("/api/v1/debug/publish")
                        .with(jwt().jwt(jwt -> jwt.subject("admin_user")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(content().string("Published to Redis channel: " + expectedTopic));
    }

    @Test
    void publishManualTelemetry_Returns401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(post("/api/v1/debug/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
