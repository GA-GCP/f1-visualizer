package com.elysianarts.f1.visualizer.commons.api.openf1.client;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.*;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;

@Slf4j
@Component
public class OpenF1Client {

    private final WebClient webClient;
    private final OpenF1AuthService authService;

    private static final DateTimeFormatter API_DATE_FORMATTER = new DateTimeFormatterBuilder()
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

    @Autowired
    public OpenF1Client(WebClient.Builder webClientBuilder, OpenF1AuthService authService) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org/v1").build();
        this.authService = authService;
    }

    public OpenF1Client(WebClient webClient, OpenF1AuthService authService) {
        this.webClient = webClient;
        this.authService = authService;
    }

    public Mono<OpenF1Session> getSession(long sessionKey) {
        return webClient.get()
                .uri("/sessions?session_key=" + sessionKey)
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1Session.class)
                .next()
                .onErrorResume(e -> {
                    log.error("Error fetching Session Metadata: {}", e.getMessage());
                    return Mono.empty();
                });
    }

    public Flux<OpenF1CarData> getCarData(long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        return webClient.get()
                // Safely build the URI using Spring's native variable substitution.
                // This prevents double-encoding while ensuring characters like '+' and '<' are safely handled.
                .uri(builder -> builder
                        .path("/car_data")
                        .query("session_key={key}&date>={start}&date<{end}")
                        .build(sessionKey, startTime.format(API_DATE_FORMATTER), endTime.format(API_DATE_FORMATTER))
                )
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1CarData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Car Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    public Flux<OpenF1LocationData> getLocationData(long sessionKey, OffsetDateTime startTime, OffsetDateTime endTime) {
        return webClient.get()
                // Using the same native UriBuilder strategy for location data
                .uri(builder -> builder
                        .path("/location")
                        .query("session_key={key}&date>={start}&date<{end}")
                        .build(sessionKey, startTime.format(API_DATE_FORMATTER), endTime.format(API_DATE_FORMATTER))
                )
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1LocationData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Location Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    public Flux<OpenF1LapData> getLapData(long sessionKey) {
        return webClient.get()
                .uri("/laps?session_key=" + sessionKey)
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1LapData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Lap Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    public Flux<OpenF1PositionData> getPositionData(long sessionKey) {
        return webClient.get()
                .uri("/position?session_key=" + sessionKey)
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1PositionData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Position Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    public Flux<OpenF1StintData> getStintData(long sessionKey) {
        return webClient.get()
                .uri("/stints?session_key=" + sessionKey)
                .header("Authorization", "Bearer " + authService.getAccessToken())
                .retrieve()
                .bodyToFlux(OpenF1StintData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Stint Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }
}