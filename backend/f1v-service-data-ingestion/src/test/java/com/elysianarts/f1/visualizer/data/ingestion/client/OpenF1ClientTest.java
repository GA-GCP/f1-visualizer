package com.elysianarts.f1.visualizer.data.ingestion.client;

import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
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

        // Act
        Flux<OpenF1CarData> dataFlux = openF1Client.getCarData(9165, null);

        // Assert
        StepVerifier.create(dataFlux)
                .expectNextMatches(data ->
                        data.getDriverNumber() == 1 &&
                                data.getSpeed() == 310 &&
                                data.getGear() == 8
                )
                .verifyComplete();
    }
}
