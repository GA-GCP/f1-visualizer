package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalLocationRepository;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReplayEngineTest {

    @Mock
    private HistoricalRepository historicalRepository;

    @Mock
    private HistoricalLocationRepository historicalLocationRepository;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @InjectMocks
    private ReplayEngine replayEngine;

    private List<OpenF1CarData> dummyData;

    @BeforeEach
    void setUp() {
        dummyData = new ArrayList<>();
        // Baseline time to build from
        OffsetDateTime baseTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);

        // Create 10 dummy packets spaced by 100ms each
        for (int i = 0; i < 10; i++) {
            OpenF1CarData packet = new OpenF1CarData();
            packet.setDriverNumber(1);
            packet.setSpeed(100 + i);
            // NEW: Set the Date so the Virtual Clock works!
            packet.setDate(baseTime.plusNanos(i * 100_000_000L));
            dummyData.add(packet);
        }
    }

    @Test
    void loadSession_InitializesBufferAndStarts() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);

        replayEngine.loadSession(9165L);

        // Tick advances clock by 250ms.
        // Packets exist at T+0, T+100, and T+200.
        // Therefore, exactly 3 packets should fall into the first tick window.
        replayEngine.tick();

        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void pauseAndPlay_TogglesSimulationState() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);

        // Pause
        replayEngine.pause();
        replayEngine.tick(); // Should do nothing
        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));

        // Play
        replayEngine.play();
        replayEngine.tick(); // Should process 3 packets (0ms, 100ms, 200ms)
        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_UpdatesIndexCorrectly() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L); // 10 items (indexes 0 to 9)

        // Pause so tick() doesn't auto-advance
        replayEngine.pause();

        // Seek to 50% (targets index 4, which is at T+400ms)
        replayEngine.seek(50);
        replayEngine.play();

        // Tick adds 250ms -> virtual clock is now T+650ms.
        // Should process index 4 (400ms), 5 (500ms), 6 (600ms). (3 packets)
        replayEngine.tick();
        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));

        // Tick again adds 250ms -> virtual clock is now T+900ms.
        // Should process index 7 (700ms), 8 (800ms), 9 (900ms). (3 packets)
        replayEngine.tick();
        verify(redisTemplate, times(6)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }
}