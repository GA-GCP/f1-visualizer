package com.elysianarts.f1.visualizer.commons.api.openf1.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.OpenF1CredentialsConfig.OpenF1Credentials;
import java.io.IOException;
import java.time.Duration;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.client.RestClient;

/**
 * C3, T1: this used to mock the WebClient fluent chain six objects deep and build the private
 * {@code AuthResponse} by reflection, which meant the test asserted the shape of the mocks rather
 * than the behaviour of the service. Against a real HTTP server it can assert what is actually sent
 * and what is actually parsed.
 */
class OpenF1AuthServiceTest {

    private MockWebServer server;
    private final TaskScheduler taskScheduler = mock(TaskScheduler.class);

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    private OpenF1AuthService serviceWith(OpenF1Credentials credentials) {
        RestClient client = RestClient.builder().baseUrl(server.url("/").toString()).build();
        return new OpenF1AuthService(client, credentials, taskScheduler);
    }

    private OpenF1AuthService service() {
        return serviceWith(new OpenF1Credentials("test-user@email.com", "test-password-123"));
    }

    @Test
    void refreshToken_SetsAccessToken_AndPostsTheCredentialsAsAForm() throws Exception {
        server.enqueue(
                new MockResponse()
                        .setBody(
                                "{\"access_token\":\"mock-openf1-jwt-token\",\"token_type\":\"bearer\",\"expires_in\":3600}")
                        .addHeader("Content-Type", "application/json"));

        OpenF1AuthService authService = service();
        authService.refreshToken();

        assertEquals("mock-openf1-jwt-token", authService.getAccessToken());

        RecordedRequest request = server.takeRequest();
        assertEquals("/token", request.getPath());
        assertTrue(
                request.getHeader("Content-Type").startsWith("application/x-www-form-urlencoded"));
        assertTrue(request.getBody().readUtf8().contains("username=test-user%40email.com"));
    }

    @Test
    void refreshToken_DoesNotSetToken_WhenResponseHasNoToken() {
        server.enqueue(
                new MockResponse()
                        .setBody("{\"token_type\":\"bearer\"}")
                        .addHeader("Content-Type", "application/json"));

        OpenF1AuthService authService = service();
        authService.refreshToken();

        assertNull(authService.getAccessToken());
    }

    @Test
    void refreshToken_DoesNotThrow_WhenServerReturnsError() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("boom"));

        OpenF1AuthService authService = service();

        assertDoesNotThrow(authService::refreshToken);
        assertNull(authService.getAccessToken());
    }

    @Test
    void refreshToken_SkipsAuth_WhenCredentialsAreNull() {
        OpenF1AuthService authService = serviceWith(null);

        assertDoesNotThrow(authService::refreshToken);
        assertNull(authService.getAccessToken());
        assertEquals(0, server.getRequestCount(), "no request should be made without credentials");
    }

    @Test
    void getAccessToken_ReturnsNull_BeforeRefresh() {
        assertNull(service().getAccessToken());
    }

    /** S6: callers must not send `Bearer null` and read the 401 back as "no data". */
    @Test
    void requireAccessToken_Throws_BeforeRefresh() {
        OpenF1AuthService authService = service();
        assertThrows(IllegalStateException.class, authService::requireAccessToken);
    }

    @Test
    void refreshToken_UpdatesToken_OnSubsequentCalls() {
        server.enqueue(
                new MockResponse()
                        .setBody("{\"access_token\":\"token-v1\",\"expires_in\":3600}")
                        .addHeader("Content-Type", "application/json"));
        server.enqueue(
                new MockResponse()
                        .setBody("{\"access_token\":\"token-v2\",\"expires_in\":3600}")
                        .addHeader("Content-Type", "application/json"));

        OpenF1AuthService authService = service();

        authService.refreshToken();
        assertEquals("token-v1", authService.getAccessToken());

        authService.refreshToken();
        assertEquals("token-v2", authService.getAccessToken());
    }

    /** R7: the next refresh is scheduled from what the server returned, not a fixed 50 minutes. */
    @Test
    void refreshToken_SchedulesFromExpiresIn() {
        server.enqueue(
                new MockResponse()
                        .setBody("{\"access_token\":\"t\",\"expires_in\":3600}")
                        .addHeader("Content-Type", "application/json"));

        // 3600s lifetime minus the 5 minute safety margin.
        assertEquals(Duration.ofMinutes(55), service().refreshToken());
    }

    @Test
    void nextInterval_FallsBack_WhenExpiresInIsAbsentOrNonsense() {
        assertEquals(Duration.ofMinutes(50), OpenF1AuthService.nextInterval(null));
        assertEquals(Duration.ofMinutes(50), OpenF1AuthService.nextInterval(0));
        assertEquals(Duration.ofMinutes(50), OpenF1AuthService.nextInterval(-1));
    }

    @Test
    void nextInterval_ClampsToAMinute_WhenLifetimeIsShorterThanTheMargin() {
        assertEquals(Duration.ofMinutes(1), OpenF1AuthService.nextInterval(60));
    }
}
