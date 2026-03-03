package com.elysianarts.f1.visualizer.data.ingestion.client;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LapData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OpenF1ClientTest {
    private MockWebServer mockWebServer;
    private OpenF1Client openF1Client;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();

        JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();

        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(configurer -> {
                    configurer.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(mapper));
                })
                .build();

        WebClient testWebClient = WebClient.builder()
                .baseUrl(mockWebServer.url("/").toString())
                .exchangeStrategies(strategies)
                .build();

        OpenF1AuthService mockAuthService = mock(OpenF1AuthService.class);
        when(mockAuthService.getAccessToken()).thenReturn("dummy-test-token");

        openF1Client = new OpenF1Client(testWebClient, mockAuthService);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    @Test
    void getCarData_ParsesJsonCorrectly() {
        String mockJson = """
            [
              {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.123Z",
                "driver_number": 1,
                "speed": 310,
                "rpm": 11500,
                "n_gear": 8,
                "throttle": 100,
                "brake": 0,
                "drs": 1
              }
            ]
            """;

        mockWebServer.enqueue(new MockResponse()
                .setBody(mockJson)
                .addHeader("Content-Type", "application/json"));

        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusSeconds(2);

        Flux<OpenF1CarData> dataFlux = openF1Client.getCarData(9165, start, end);

        StepVerifier.create(dataFlux)
                .expectNextMatches(data ->
                        data.getDriverNumber() == 1 &&
                                data.getSpeed() == 310 &&
                                data.getGear() == 8
                )
                .verifyComplete();
    }

    @Test
    void getLocationData_ParsesJsonCorrectly() {
        String mockJson = """
            [
              {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.456Z",
                "driver_number": 1,
                "x": 1200,
                "y": 3400,
                "z": 100
              }
            ]
            """;

        mockWebServer.enqueue(new MockResponse()
                .setBody(mockJson)
                .addHeader("Content-Type", "application/json"));

        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusSeconds(2);

        Flux<OpenF1LocationData> dataFlux = openF1Client.getLocationData(9165, start, end);

        StepVerifier.create(dataFlux)
                .expectNextMatches(data ->
                        data.getDriverNumber() == 1 &&
                                data.getX() == 1200 &&
                                data.getY() == 3400
                )
                .verifyComplete();
    }

    @Test
    void getCarData_ReturnsEmpty_WhenApiReturnsEmptyArray() {
        mockWebServer.enqueue(new MockResponse()
                .setBody("[]")
                .addHeader("Content-Type", "application/json"));

        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusSeconds(2);

        Flux<OpenF1CarData> dataFlux = openF1Client.getCarData(9165, start, end);

        StepVerifier.create(dataFlux)
                .verifyComplete();
    }

    @Test
    void getCarData_ReturnsEmpty_WhenApiReturns500() {
        mockWebServer.enqueue(new MockResponse()
                .setResponseCode(500)
                .setBody("Internal Server Error"));

        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusSeconds(2);

        Flux<OpenF1CarData> dataFlux = openF1Client.getCarData(9165, start, end);

        // Client uses onErrorResume to swallow errors and return empty
        StepVerifier.create(dataFlux)
                .verifyComplete();
    }

    @Test
    void getSession_ParsesSessionCorrectly() {
        String mockJson = """
            [
              {
                "session_key": 9165,
                "date_start": "2023-09-17T12:00:00.000Z",
                "date_end": "2023-09-17T14:00:00.000Z"
              }
            ]
            """;

        mockWebServer.enqueue(new MockResponse()
                .setBody(mockJson)
                .addHeader("Content-Type", "application/json"));

        Mono<OpenF1Session> sessionMono = openF1Client.getSession(9165);

        StepVerifier.create(sessionMono)
                .expectNextMatches(session ->
                        session.getSessionKey() == 9165 &&
                                session.getDateStart() != null &&
                                session.getDateEnd() != null
                )
                .verifyComplete();
    }

    @Test
    void getSession_ReturnsEmpty_WhenApiReturnsEmptyArray() {
        mockWebServer.enqueue(new MockResponse()
                .setBody("[]")
                .addHeader("Content-Type", "application/json"));

        Mono<OpenF1Session> sessionMono = openF1Client.getSession(9999);

        StepVerifier.create(sessionMono)
                .verifyComplete();
    }

    @Test
    void getLapData_ParsesLapDataCorrectly() {
        String mockJson = """
            [
              {
                "session_key": 9165,
                "meeting_key": 1219,
                "driver_number": 1,
                "lap_number": 5,
                "lap_duration": 92.456,
                "duration_sector_1": 28.123,
                "duration_sector_2": 33.789,
                "duration_sector_3": 30.544
              }
            ]
            """;

        mockWebServer.enqueue(new MockResponse()
                .setBody(mockJson)
                .addHeader("Content-Type", "application/json"));

        Flux<OpenF1LapData> dataFlux = openF1Client.getLapData(9165);

        StepVerifier.create(dataFlux)
                .expectNextMatches(lap ->
                        lap.getDriverNumber() == 1 &&
                                lap.getLapNumber() == 5 &&
                                lap.getLapDuration() == 92.456
                )
                .verifyComplete();
    }
}
