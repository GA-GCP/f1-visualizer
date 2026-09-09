package com.elysianarts.f1.visualizer.commons.api.openf1.client;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.*;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.retry.RetryPolicy;
import org.springframework.core.retry.RetryTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * The OpenF1 REST API.
 *
 * <p><b>C3: blocking, and honest about it.</b> This used to return {@code Mono} and {@code Flux},
 * and every caller immediately {@code .block()}ed them. The service runs on Tomcat and WebMvc;
 * WebFlux was on the classpath solely to provide {@code WebClient}, which meant a second HTTP
 * stack, reactor-netty, an empty Maven module and a six-mock fluent chain in the tests — for no
 * non-blocking benefit anywhere. {@code RestClient} does the same work against the same connection
 * pool, and virtual threads (P4) make the blocking free.
 *
 * <p><b>R5: failures are failures.</b> Every method used to map every error to an empty result, so
 * a 401 from an expired token read as "this session has no lap data". Transient answers — 429 and
 * 5xx — are retried with exponential backoff; everything else is raised as {@link OpenF1Exception}.
 */
@Slf4j
@Component
public class OpenF1Client {

    /** Politeness on a rate-limited API; also the unit of exponential growth. */
    static final Duration DEFAULT_FIRST_BACKOFF = Duration.ofMillis(500);

    private static final DateTimeFormatter API_DATE_FORMATTER =
            new DateTimeFormatterBuilder()
                    .append(DateTimeFormatter.ISO_LOCAL_DATE)
                    .appendLiteral('T')
                    .appendValue(ChronoField.HOUR_OF_DAY, 2)
                    .appendLiteral(':')
                    .appendValue(ChronoField.MINUTE_OF_HOUR, 2)
                    .appendLiteral(':')
                    .appendValue(ChronoField.SECOND_OF_MINUTE, 2)
                    .appendFraction(ChronoField.MILLI_OF_SECOND, 3, 3, true)
                    .appendOffset("+HH:MM", "+00:00")
                    .toFormatter();

    private static final ParameterizedTypeReference<List<OpenF1CarData>> CAR_DATA =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1LocationData>> LOCATIONS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1LapData>> LAPS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1PositionData>> POSITIONS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1StintData>> STINTS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1Session>> SESSIONS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1Driver>> DRIVERS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<OpenF1Meeting>> MEETINGS =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final OpenF1AuthService authService;
    private final RetryTemplate retryTemplate;

    @Autowired
    public OpenF1Client(
            RestClient.Builder restClientBuilder,
            OpenF1AuthService authService,
            @Value("${f1v.openf1.base-url:https://api.openf1.org/v1}") String baseUrl,
            @Value("${f1v.openf1.retry.first-backoff:500ms}") Duration firstBackoff) {
        this(restClientBuilder.baseUrl(baseUrl).build(), authService, firstBackoff);
    }

    /**
     * The retry backoff is a parameter because how patient to be with a rate-limited API is an
     * operational decision — and tests need it near zero.
     */
    public OpenF1Client(
            RestClient restClient, OpenF1AuthService authService, Duration firstBackoff) {
        this.restClient = restClient;
        this.authService = authService;
        this.retryTemplate =
                new RetryTemplate(
                        RetryPolicy.builder()
                                .maxRetries(3)
                                .delay(firstBackoff)
                                .multiplier(2.0)
                                .predicate(OpenF1Client::isTransient)
                                .build());
    }

    /** 429 and 5xx are OpenF1 asking us to come back. A 401 is an answer. */
    static boolean isTransient(Throwable error) {
        if (error instanceof RestClientResponseException response) {
            int status = response.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        // Connection resets and read timeouts carry no status and are worth another try.
        return !(error instanceof OpenF1Exception);
    }

    public Optional<OpenF1Session> getSession(long sessionKey) {
        List<OpenF1Session> sessions =
                get(
                        "Session Metadata",
                        SESSIONS,
                        b -> b.path("/sessions").queryParam("session_key", sessionKey).build());
        return sessions.isEmpty() ? Optional.empty() : Optional.of(sessions.get(0));
    }

    public List<OpenF1CarData> getCarData(
            long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        // Built with Spring's own variable substitution: it keeps '+' and '<' from
        // being double-encoded, which OpenF1's range syntax needs.
        return get(
                "Car Data",
                CAR_DATA,
                b ->
                        b.path("/car_data")
                                .query("session_key={key}&date>={start}&date<{end}")
                                .build(
                                        sessionKey,
                                        startTime.format(API_DATE_FORMATTER),
                                        endTime.format(API_DATE_FORMATTER)));
    }

    public List<OpenF1LocationData> getLocationData(
            long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        return get(
                "Location Data",
                LOCATIONS,
                b ->
                        b.path("/location")
                                .query("session_key={key}&date>={start}&date<{end}")
                                .build(
                                        sessionKey,
                                        startTime.format(API_DATE_FORMATTER),
                                        endTime.format(API_DATE_FORMATTER)));
    }

    public List<OpenF1LapData> getLapData(long sessionKey) {
        return get(
                "Lap Data",
                LAPS,
                b -> b.path("/laps").queryParam("session_key", sessionKey).build());
    }

    public List<OpenF1PositionData> getPositionData(long sessionKey) {
        return get(
                "Position Data",
                POSITIONS,
                b -> b.path("/position").queryParam("session_key", sessionKey).build());
    }

    public List<OpenF1StintData> getStintData(long sessionKey) {
        return get(
                "Stint Data",
                STINTS,
                b -> b.path("/stints").queryParam("session_key", sessionKey).build());
    }

    // ── Reference data (C4: was hand-rolled against untyped Maps) ──

    public List<OpenF1Session> getSessionsForYear(int year) {
        return get("Sessions", SESSIONS, b -> b.path("/sessions").queryParam("year", year).build());
    }

    /** {@code sessionKey} accepts OpenF1's {@code latest} as well as a numeric key. */
    public List<OpenF1Driver> getDrivers(String sessionKey) {
        return get(
                "Drivers",
                DRIVERS,
                b -> b.path("/drivers").queryParam("session_key", sessionKey).build());
    }

    public List<OpenF1Meeting> getMeetings(int year) {
        return get("Meetings", MEETINGS, b -> b.path("/meetings").queryParam("year", year).build());
    }

    // ── Plumbing ──

    private <T> List<T> get(
            String what,
            ParameterizedTypeReference<List<T>> type,
            java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI>
                    uri) {
        Supplier<List<T>> call =
                () -> {
                    List<T> body =
                            restClient
                                    .get()
                                    .uri(uri)
                                    .header(
                                            "Authorization",
                                            "Bearer " + authService.requireAccessToken())
                                    .retrieve()
                                    .body(type);
                    return body == null ? List.of() : body;
                };
        try {
            // invoke() unwraps its own RetryException and rethrows the last cause,
            // so what surfaces here is the failure the API actually produced.
            return retryTemplate.invoke(call);
        } catch (OpenF1Exception e) {
            throw e;
        } catch (RuntimeException e) {
            throw new OpenF1Exception("Failed to fetch " + what, e);
        }
    }
}
