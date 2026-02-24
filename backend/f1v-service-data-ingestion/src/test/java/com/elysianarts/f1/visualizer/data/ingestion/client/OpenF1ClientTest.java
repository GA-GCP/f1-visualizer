package com.elysianarts.f1.visualizer.data.ingestion.client;

import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

class OpenF1ClientTest {
    private MockWebServer mockWebServer;
    private OpenF1Client openF1Client;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();

        JsonMapper mapper = JsonMapper.builder().build();

        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(configurer -> {
                    configurer.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(mapper));
                })
                .build();

        WebClient testWebClient = WebClient.builder()
                .baseUrl(mockWebServer.url("/").toString())
                .exchangeStrategies(strategies)
                .build();

        openF1Client = new OpenF1Client(testWebClient);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    @Test
    void getCarData_ParsesJsonCorrectly() {
        // Arrange
        String mockJson = """
            [
              {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.123Z",
                "driver_number": 1,
                "speed": 310,
                "rpm": 11500,
                "gear": 8,
                "throttle": 100,
                "brake": 0,
                "drs": 1
              }
            ]
            """;

        mockWebServer.enqueue(new MockResponse()
                .setBody(mockJson)
                .addHeader("Content-Type", "application/json"));

        // Define a dummy time window
        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusSeconds(2);

        // Act
        // UPDATED: Now passing start and end times
        Flux<OpenF1CarData> dataFlux = openF1Client.getCarData(9165, start, end);

        // Assert
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
        // Arrange
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

        // Act
        Flux<OpenF1LocationData> dataFlux = openF1Client.getLocationData(9165, start, end);

        // Assert
        StepVerifier.create(dataFlux)
                .expectNextMatches(data ->
                        data.getDriverNumber() == 1 &&
                                data.getX() == 1200 &&
                                data.getY() == 3400
                )
                .verifyComplete();
    }
}
