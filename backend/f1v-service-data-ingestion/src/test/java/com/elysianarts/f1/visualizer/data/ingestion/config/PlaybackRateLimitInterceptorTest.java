package com.elysianarts.f1.visualizer.data.ingestion.config;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

class PlaybackRateLimitInterceptorTest {

    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static HttpServletRequest request() {
        return new MockHttpServletRequest("POST", "/api/v1/ingestion/playback/seek");
    }

    private static void authenticateAs(String subject) {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken(subject, "n/a"));
    }

    /**
     * S1: play, pause and seek change what every other viewer is watching, and every seek costs a
     * synchronous BigQuery query. They stay open to any authenticated user, so this is what stops
     * one client driving the replay for everyone.
     */
    @Test
    void rejectsOnceThePermitsInTheWindowAreSpent() {
        PlaybackRateLimitInterceptor interceptor =
                new PlaybackRateLimitInterceptor(3, Duration.ofMinutes(1));
        authenticateAs("auth0|viewer");

        for (int i = 0; i < 3; i++) {
            assertTrue(
                    interceptor.preHandle(request(), response, null),
                    "permit " + (i + 1) + " should pass");
        }

        ResponseStatusException rejected =
                assertThrows(
                        ResponseStatusException.class,
                        () -> interceptor.preHandle(request(), response, null));
        assertEquals(429, rejected.getStatusCode().value());
    }

    /** One noisy client must not spend another viewer's allowance. */
    @Test
    void countsPerSubject() {
        PlaybackRateLimitInterceptor interceptor =
                new PlaybackRateLimitInterceptor(1, Duration.ofMinutes(1));

        authenticateAs("auth0|first");
        assertTrue(interceptor.preHandle(request(), response, null));
        assertThrows(
                ResponseStatusException.class,
                () -> interceptor.preHandle(request(), response, null));

        authenticateAs("auth0|second");
        assertTrue(interceptor.preHandle(request(), response, null));
    }

    @Test
    void allowanceReturnsWhenTheWindowRolls() throws Exception {
        PlaybackRateLimitInterceptor interceptor =
                new PlaybackRateLimitInterceptor(1, Duration.ofMillis(50));
        authenticateAs("auth0|viewer");

        assertTrue(interceptor.preHandle(request(), response, null));
        assertThrows(
                ResponseStatusException.class,
                () -> interceptor.preHandle(request(), response, null));

        Thread.sleep(60);
        assertTrue(interceptor.preHandle(request(), response, null));
    }
}
