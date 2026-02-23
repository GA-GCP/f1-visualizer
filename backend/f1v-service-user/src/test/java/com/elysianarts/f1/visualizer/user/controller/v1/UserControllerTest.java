package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.elysianarts.f1.visualizer.user.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc
@Import(F1VisualizerSecurityConfig.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void getCurrentUser_ReturnsOk_WithValidJwt() throws Exception {
        // Arrange
        F1UserDocument mockUser = F1UserDocument.builder()
                .oktaSubId("okta_123")
                .email("driver@f1visualizer.com")
                .createdAt(Instant.now())
                .build();

        when(userService.getOrCreateUser("okta_123", "driver@f1visualizer.com")).thenReturn(mockUser);

        // Act & Assert
        mockMvc.perform(get("/api/v1/users/me")
                        .with(jwt().jwt(jwt -> jwt.subject("okta_123").claim("email", "driver@f1visualizer.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oktaSubId").value("okta_123"))
                .andExpect(jsonPath("$.email").value("driver@f1visualizer.com"));
    }

    @Test
    void updatePreferences_ReturnsOk_WhenValidRequest() throws Exception {
        // Arrange
        F1UserDocument.UserPreferences prefs = new F1UserDocument.UserPreferences();
        prefs.setFavoriteDriver("Max Verstappen");

        F1UserDocument mockUser = F1UserDocument.builder()
                .oktaSubId("okta_123")
                .preferences(prefs)
                .build();

        when(userService.updatePreferences(eq("okta_123"), any(F1UserDocument.UserPreferences.class))).thenReturn(mockUser);

        // Act & Assert
        mockMvc.perform(put("/api/v1/users/me/preferences")
                        .with(jwt().jwt(jwt -> jwt.subject("okta_123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(prefs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.favoriteDriver").value("Max Verstappen"));
    }
}
