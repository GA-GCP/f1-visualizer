package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.user.config.JacksonObjectMapperConfig;
import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.elysianarts.f1.visualizer.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class})
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper; // Uses the Jackson 3 Mapper from config

    @MockitoBean
    private UserService userService;

    // Required to satisfy the @EnableWebSecurity in F1VisualizerSecurityConfig
    @MockitoBean
    private JwtDecoder jwtDecoder;

    private static final String TEST_SUB = "okta_user_123";
    private static final String TEST_EMAIL = "leclerc@ferrari.com";

    @Test
    void getCurrentUser_ReturnsUser_WhenAuthenticated() throws Exception {
        // Arrange
        F1UserDocument mockUser = F1UserDocument.builder()
                .oktaSubId(TEST_SUB)
                .email(TEST_EMAIL)
                .createdAt(Instant.now())
                .preferences(new F1UserDocument.UserPreferences("Charles Leclerc", "Ferrari", "detailed", List.of()))
                .build();

        // Mock the service call logic
        when(userService.getOrCreateUser(eq(TEST_SUB), eq(TEST_EMAIL)))
                .thenReturn(mockUser);

        // Act & Assert
        mockMvc.perform(get("/api/v1/users/me")
                        // Simulate a valid JWT with specific claims
                        .with(jwt().jwt(jwt -> jwt
                                .subject(TEST_SUB)
                                .claim("email", TEST_EMAIL))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oktaSubId").value(TEST_SUB))
                .andExpect(jsonPath("$.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.preferences.favoriteDriver").value("Charles Leclerc"));
    }

    @Test
    void getCurrentUser_Returns401_WhenUnauthenticated() throws Exception {
        // Act & Assert: No JWT provided
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updatePreferences_ReturnsUpdatedUser_WhenPayloadIsValid() throws Exception {
        // Arrange
        F1UserDocument.UserPreferences newPrefs = new F1UserDocument.UserPreferences();
        newPrefs.setFavoriteDriver("Max Verstappen");
        newPrefs.setTeam("Red Bull");

        F1UserDocument updatedUser = F1UserDocument.builder()
                .oktaSubId(TEST_SUB)
                .email(TEST_EMAIL)
                .preferences(newPrefs)
                .build();

        when(userService.updatePreferences(eq(TEST_SUB), any(F1UserDocument.UserPreferences.class)))
                .thenReturn(updatedUser);

        // Act & Assert
        mockMvc.perform(put("/api/v1/users/me/preferences")
                        .with(jwt().jwt(jwt -> jwt.subject(TEST_SUB)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPrefs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.favoriteDriver").value("Max Verstappen"))
                .andExpect(jsonPath("$.preferences.team").value("Red Bull"));
    }
}