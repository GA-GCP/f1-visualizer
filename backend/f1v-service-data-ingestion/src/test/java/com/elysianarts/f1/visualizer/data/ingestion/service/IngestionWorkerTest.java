package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
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
        // Arrange
        OpenF1CarData packet = new OpenF1CarData();
        packet.setDriverNumber(1);
        packet.setSpeed(300);
        packet.setDate(OffsetDateTime.now());

        when(openF1Client.getCarData(eq(9165L), any())).thenReturn(Flux.just(packet));

        // Act
        ingestionWorker.ingestTelemetryLoop();

        // Assert
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), eq(packet));
    }
}
