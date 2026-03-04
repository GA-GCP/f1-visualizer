package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.commons.security.config.F1VisualizerSecurityConfig;
import com.elysianarts.f1.visualizer.commons.service.config.JacksonObjectMapperConfig;
import com.elysianarts.f1.visualizer.user.exception.GlobalExceptionHandler;
import com.elysianarts.f1.visualizer.user.exception.UserNotFoundException;
import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.service.F1VUserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import com.google.cloud.firestore.Firestore;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import com.google.cloud.Timestamp;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(F1VUserController.class)
@AutoConfigureMockMvc
@Import({F1VisualizerSecurityConfig.class, JacksonObjectMapperConfig.class, GlobalExceptionHandler.class})
class F1VUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private F1VUserService f1VUserService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private Firestore firestore;

    private static final String TEST_SUB = "auth0|user_123";
    private static final String TEST_EMAIL = "leclerc@ferrari.com";

    @Test
    void getCurrentUser_ReturnsUser_WhenAuthenticated() throws Exception {
        F1VUserDocument mockUser = F1VUserDocument.builder()
                .authSubId(TEST_SUB)
                .email(TEST_EMAIL)
                .createdAt(Timestamp.now())
                .preferences(new F1VUserDocument.UserPreferences("Charles Leclerc", "Ferrari", "detailed", List.of()))
                .build();

        when(f1VUserService.getOrCreateUser(eq(TEST_SUB), eq(TEST_EMAIL)))
                .thenReturn(mockUser);

        mockMvc.perform(get("/api/v1/users/me")
                        .with(jwt().jwt(jwt -> jwt
                                .subject(TEST_SUB)
                                .claim("email", TEST_EMAIL))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authSubId").value(TEST_SUB))
                .andExpect(jsonPath("$.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.preferences.favoriteDriver").value("Charles Leclerc"));
    }

    @Test
    void getCurrentUser_Returns401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updatePreferences_ReturnsUpdatedUser_WhenPayloadIsValid() throws Exception {
        F1VUserDocument.UserPreferences newPrefs = new F1VUserDocument.UserPreferences();
        newPrefs.setFavoriteDriver("Max Verstappen");
        newPrefs.setTeam("Red Bull");

        F1VUserDocument updatedUser = F1VUserDocument.builder()
                .authSubId(TEST_SUB)
                .email(TEST_EMAIL)
                .preferences(newPrefs)
                .build();

        when(f1VUserService.updatePreferences(eq(TEST_SUB), any(F1VUserDocument.UserPreferences.class)))
                .thenReturn(updatedUser);

        mockMvc.perform(put("/api/v1/users/me/preferences")
                        .with(jwt().jwt(jwt -> jwt.subject(TEST_SUB)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPrefs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.favoriteDriver").value("Max Verstappen"))
                .andExpect(jsonPath("$.preferences.team").value("Red Bull"));
    }

    @Test
    void getCurrentUser_Returns500_WhenServiceThrows() throws Exception {
        when(f1VUserService.getOrCreateUser(eq(TEST_SUB), eq(TEST_EMAIL)))
                .thenThrow(new RuntimeException("Firestore connection failed"));

        mockMvc.perform(get("/api/v1/users/me")
                        .with(jwt().jwt(jwt -> jwt
                                .subject(TEST_SUB)
                                .claim("email", TEST_EMAIL))))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500));
    }

    @Test
    void updatePreferences_Returns404_WhenUserNotFound() throws Exception {
        when(f1VUserService.updatePreferences(eq(TEST_SUB), any(F1VUserDocument.UserPreferences.class)))
                .thenThrow(new UserNotFoundException(TEST_SUB));

        mockMvc.perform(put("/api/v1/users/me/preferences")
                        .with(jwt().jwt(jwt -> jwt.subject(TEST_SUB)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"favoriteDriver\":\"VER\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void getCurrentUser_Returns400_WhenEmailClaimMissing() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .with(jwt().jwt(jwt -> jwt.subject(TEST_SUB))))
                .andExpect(status().isBadRequest());
    }
}
