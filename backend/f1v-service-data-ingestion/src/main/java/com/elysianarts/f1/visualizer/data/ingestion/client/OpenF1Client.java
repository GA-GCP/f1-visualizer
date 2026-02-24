package com.elysianarts.f1.visualizer.data.ingestion.client;

import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;

@Slf4j
@Component
public class OpenF1Client {

    private final WebClient webClient;

    // Strict ISO 8601 Formatter (e.g. 2023-09-17T12:00:00.123+00:00)
    // Truncates extra nanoseconds that cause 422s
    private static final DateTimeFormatter API_DATE_FORMATTER = new DateTimeFormatterBuilder()
            .append(DateTimeFormatter.ISO_LOCAL_DATE)
            .appendLiteral('T')
            .appendValue(ChronoField.HOUR_OF_DAY, 2)
            .appendLiteral(':')
            .appendValue(ChronoField.MINUTE_OF_HOUR, 2)
            .appendLiteral(':')
            .appendValue(ChronoField.SECOND_OF_MINUTE, 2)
            .appendFraction(ChronoField.MILLI_OF_SECOND, 3, 3, true)
            .appendOffset("+HH:MM", "+00:00") // Critical: Keep the Timezone
            .toFormatter();

    @Autowired
    public OpenF1Client(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org/v1").build();
    }

    public OpenF1Client(WebClient webClient) {
        this.webClient = webClient;
    }

    // UPDATED: Accepts start AND end time
    public Flux<OpenF1CarData> getCarData(long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        String uri = "/car_data?session_key=" + sessionKey +
                "&date>=" + startTime.format(API_DATE_FORMATTER) +
                "&date<" + endTime.format(API_DATE_FORMATTER);

        log.debug("Polling Car Data Window: {} -> {}", startTime, endTime);

        return webClient.get().uri(uri).retrieve().bodyToFlux(OpenF1CarData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Car Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    // UPDATED: Accepts start AND end time
    public Flux<OpenF1LocationData> getLocationData(long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        String uri = "/location?session_key=" + sessionKey +
                "&date>=" + startTime.format(API_DATE_FORMATTER) +
                "&date<" + endTime.format(API_DATE_FORMATTER);

        log.debug("Polling Location Window: {} -> {}", startTime, endTime);

        return webClient.get().uri(uri).retrieve().bodyToFlux(OpenF1LocationData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Location Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }
}