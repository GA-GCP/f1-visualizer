package com.elysianarts.f1.visualizer.commons.api.openf1.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.SecretManagerConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OpenF1AuthServiceTest {

    @Mock
    private WebClient.Builder webClientBuilder;

    @Mock
    private WebClient webClient;

    private OpenF1AuthService authService;

    @BeforeEach
    void setUp() {
        when(webClientBuilder.baseUrl(anyString())).thenReturn(webClientBuilder);
        when(webClientBuilder.build()).thenReturn(webClient);

        SecretManagerConfig.OpenF1Credentials credentials =
                new SecretManagerConfig.OpenF1Credentials("test-user@email.com", "test-password-123");
        authService = new OpenF1AuthService(webClientBuilder, credentials);
    }

    // ── Helpers ──

    /**
     * Create an AuthResponse instance via reflection (private inner class).
     */
    private Object createAuthResponse(String accessToken) throws Exception {
        Class<?> authResponseClass = null;
        for (Class<?> c : OpenF1AuthService.class.getDeclaredClasses()) {
            if (c.getSimpleName().equals("AuthResponse")) {
                authResponseClass = c;
                break;
            }
        }
        assertNotNull(authResponseClass, "AuthResponse inner class must exist");

        Constructor<?> ctor = authResponseClass.getDeclaredConstructor();
        ctor.setAccessible(true);
        Object response = ctor.newInstance();

        Field field = authResponseClass.getDeclaredField("accessToken");
        field.setAccessible(true);
        field.set(response, accessToken);

        return response;
    }

    /**
     * Stub the full WebClient POST chain to return the given Mono.
     * Creates fresh intermediate mocks each call to avoid strict-stubbing conflicts.
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubPostChain(Mono monoResponse) {
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(webClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(any(Class.class))).thenReturn(monoResponse);
    }

    // ── Tests ──

    @Test
    void refreshToken_SetsAccessToken_WhenAuthSucceeds() throws Exception {
        Object authResponse = createAuthResponse("mock-openf1-jwt-token");
        stubPostChain(Mono.just(authResponse));

        authService.refreshToken();

        assertEquals("mock-openf1-jwt-token", authService.getAccessToken());
    }

    @Test
    void refreshToken_DoesNotSetToken_WhenResponseIsNull() {
        stubPostChain(Mono.empty());

        authService.refreshToken();

        assertNull(authService.getAccessToken());
    }

    @Test
    void refreshToken_DoesNotThrow_WhenServerReturnsError() {
        stubPostChain(Mono.error(new RuntimeException("Server error")));

        assertDoesNotThrow(() -> authService.refreshToken());
        assertNull(authService.getAccessToken());
    }

    @Test
    void refreshToken_SkipsAuth_WhenCredentialsAreNull() {
        OpenF1AuthService serviceWithNullCreds = new OpenF1AuthService(webClientBuilder, null);

        assertDoesNotThrow(() -> serviceWithNullCreds.refreshToken());
        assertNull(serviceWithNullCreds.getAccessToken());
        verify(webClient, never()).post();
    }

    @Test
    void getAccessToken_ReturnsNull_BeforeRefresh() {
        assertNull(authService.getAccessToken());
    }

    @Test
    void refreshToken_UpdatesToken_OnSubsequentCalls() throws Exception {
        Object tokenV1 = createAuthResponse("token-v1");
        stubPostChain(Mono.just(tokenV1));
        authService.refreshToken();
        assertEquals("token-v1", authService.getAccessToken());

        Object tokenV2 = createAuthResponse("token-v2");
        stubPostChain(Mono.just(tokenV2));
        authService.refreshToken();
        assertEquals("token-v2", authService.getAccessToken());
    }
}
