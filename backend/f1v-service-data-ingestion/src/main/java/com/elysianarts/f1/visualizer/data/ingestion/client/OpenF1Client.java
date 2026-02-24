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

@Slf4j
@Component
public class OpenF1Client {
    private final WebClient webClient;

    @Autowired
    public OpenF1Client(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org/v1").build();
    }

    public OpenF1Client(WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Fetches car data (telemetry) for a specific session after a specific time.
     * This allows us to "poll" for only the newest packets.
     *
     * @param sessionKey The ID of the race session (e.g., 9165 for Singapore 2023)
     * @param afterTime  The timestamp of the last packet we received.
     * @return A stream of new car data packets.
     */
    public Flux<OpenF1CarData> getCarData(long sessionKey, OffsetDateTime afterTime) {
        String uri = "/car_data?session_key=" + sessionKey;

        // If we have a 'last seen' time, append it to filter the query
        if (afterTime != null) {
            // OpenF1 expects ISO-8601 format
            uri += "&date>=" + afterTime.format(DateTimeFormatter.ISO_DATE_TIME);
        }

        log.debug("Polling OpenF1: {}", uri);

        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToFlux(OpenF1CarData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching data from OpenF1: {}", e.getMessage());
                    return Flux.empty();
                });
    }

    public Flux<OpenF1LocationData> getLocationData(long sessionKey, OffsetDateTime afterTime) {
        String uri = "/location?session_key=" + sessionKey;
        if (afterTime != null) {
            uri += "&date>=" + afterTime.format(DateTimeFormatter.ISO_DATE_TIME);
        }
        log.debug("Polling OpenF1 Location: {}", uri);
        return webClient.get().uri(uri).retrieve().bodyToFlux(OpenF1LocationData.class)
                .onErrorResume(e -> {
                    log.error("Error fetching Location Data: {}", e.getMessage());
                    return Flux.empty();
                });
    }
}
