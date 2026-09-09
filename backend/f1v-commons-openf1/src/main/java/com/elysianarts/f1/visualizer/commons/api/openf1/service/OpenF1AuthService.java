package com.elysianarts.f1.visualizer.commons.api.openf1.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.OpenF1CredentialsConfig.OpenF1Credentials;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Holds the OpenF1 sponsor-tier bearer token and keeps it fresh.
 *
 * <p><b>Threading (R7).</b> The token is read from HTTP, scheduler and MQTT threads, so it lives in
 * an {@link AtomicReference} rather than a plain field. The refresh itself no longer runs on Boot's
 * single shared {@code TaskScheduler} thread on a fixed rate, where a slow {@code /token} response
 * froze the 250 ms replay tick for its duration, and no longer runs in {@code @PostConstruct},
 * where it delayed readiness on every deploy. The first refresh is scheduled from {@link
 * ApplicationReadyEvent} and each subsequent one is scheduled from the {@code expires_in} the
 * server actually returned.
 */
@Slf4j
@Service
public class OpenF1AuthService {

    /** Refresh this far before expiry, so a slow round trip never races the deadline. */
    private static final Duration EXPIRY_MARGIN = Duration.ofMinutes(5);

    /** Used when the server omits expires_in, and as the retry delay after a failure. */
    private static final Duration FALLBACK_INTERVAL = Duration.ofMinutes(50);

    private static final Duration MIN_INTERVAL = Duration.ofMinutes(1);

    private final RestClient restClient;
    private final OpenF1Credentials credentials;
    private final TaskScheduler taskScheduler;
    private final AtomicReference<String> currentAccessToken = new AtomicReference<>();

    @Autowired
    public OpenF1AuthService(
            RestClient.Builder restClientBuilder,
            OpenF1Credentials credentials,
            TaskScheduler taskScheduler,
            @Value("${f1v.openf1.token-url:https://api.openf1.org}") String tokenBaseUrl) {
        this(restClientBuilder.baseUrl(tokenBaseUrl).build(), credentials, taskScheduler);
    }

    public OpenF1AuthService(
            RestClient restClient, OpenF1Credentials credentials, TaskScheduler taskScheduler) {
        this.restClient = restClient;
        this.credentials = credentials;
        this.taskScheduler = taskScheduler;
    }

    /**
     * Off the main thread, so a slow or unreachable OpenF1 does not hold up the container's
     * readiness on every deploy.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void scheduleFirstRefresh() {
        taskScheduler.schedule(this::refreshAndReschedule, Instant.now());
    }

    private void refreshAndReschedule() {
        Duration next = refreshToken();
        taskScheduler.schedule(this::refreshAndReschedule, Instant.now().plus(next));
        log.info("openf1 token refresh scheduled in={}", next);
    }

    /**
     * Fetches a new token. Returns how long to wait before the next refresh — derived from the
     * server's {@code expires_in} on success, and a fixed retry interval on failure.
     */
    public Duration refreshToken() {
        if (credentials == null
                || credentials.username() == null
                || credentials.password() == null) {
            log.warn(
                    "openf1 credentials missing — skipping authentication (expected in tests and local runs)");
            return FALLBACK_INTERVAL;
        }
        log.info("openf1 authenticating username={}", credentials.username());

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("username", credentials.username());
        formData.add("password", credentials.password());

        try {
            AuthResponse response =
                    restClient
                            .post()
                            .uri("/token")
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(formData)
                            .retrieve()
                            .body(AuthResponse.class);

            if (response != null && response.accessToken() != null) {
                currentAccessToken.set(response.accessToken());
                log.info("openf1 authentication succeeded expires_in={}", response.expiresIn());
                return nextInterval(response.expiresIn());
            }
            log.error("openf1 authentication returned no token");
        } catch (Exception e) {
            log.error("openf1 authentication failed", e);
        }
        return FALLBACK_INTERVAL;
    }

    static Duration nextInterval(Integer expiresInSeconds) {
        if (expiresInSeconds == null || expiresInSeconds <= 0) {
            return FALLBACK_INTERVAL;
        }
        Duration lifetime = Duration.ofSeconds(expiresInSeconds).minus(EXPIRY_MARGIN);
        return lifetime.compareTo(MIN_INTERVAL) < 0 ? MIN_INTERVAL : lifetime;
    }

    /** The current token, or {@code null} when authentication has not succeeded. */
    public String getAccessToken() {
        return currentAccessToken.get();
    }

    /**
     * The current token, or a thrown exception. Callers that would otherwise send {@code
     * Authorization: Bearer null} and read the resulting 401 as "no data" use this instead (S6,
     * R5).
     */
    public String requireAccessToken() {
        String token = currentAccessToken.get();
        if (token == null) {
            throw new IllegalStateException(
                    "No OpenF1 access token available — authentication has not succeeded");
        }
        return token;
    }

    /** Package-private so tests can build one without reflection (T1). */
    record AuthResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType,
            @JsonProperty("expires_in") Integer expiresIn) {}
}
