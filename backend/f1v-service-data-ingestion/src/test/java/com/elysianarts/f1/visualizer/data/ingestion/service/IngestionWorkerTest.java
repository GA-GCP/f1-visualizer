package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import reactor.core.publisher.Flux;

import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestionWorkerTest {

    @Mock
    private OpenF1Client openF1Client;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @InjectMocks
    private IngestionWorker ingestionWorker;

    @Test
    void ingestTelemetryLoop_FetchesAndPublishesData() {
        // Arrange - 1. Setup Telemetry Data
        OpenF1CarData carPacket = new OpenF1CarData();
        carPacket.setDriverNumber(1);
        carPacket.setSpeed(300);
        carPacket.setDate(OffsetDateTime.now());

        // Arrange - 2. Setup Location Data (The missing piece!)
        OpenF1LocationData locPacket = new OpenF1LocationData();
        locPacket.setDriverNumber(1);
        locPacket.setX(1000);
        locPacket.setY(2000);
        locPacket.setDate(OffsetDateTime.now());

        // Arrange - 3. Stub the Client calls
        when(openF1Client.getCarData(eq(9165L), any())).thenReturn(Flux.just(carPacket));

        // This is the line that fixes the NullPointerException:
        when(openF1Client.getLocationData(eq(9165L), any())).thenReturn(Flux.just(locPacket));

        // Act
        ingestionWorker.ingestTelemetryLoop();

        // Assert
        // Verify Telemetry was sent
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), eq(carPacket));
        // Verify Location was sent
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), eq(locPacket));
    }
}