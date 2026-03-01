package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

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
    private RedisTemplate<String, Object> redisTemplate;

    @InjectMocks
    private ReplayEngine replayEngine;

    private List<OpenF1CarData> dummyData;

    @BeforeEach
    void setUp() {
        dummyData = new ArrayList<>();
        // Create 10 dummy packets
        for (int i = 0; i < 10; i++) {
            OpenF1CarData packet = new OpenF1CarData();
            packet.setDriverNumber(1);
            packet.setSpeed(100 + i);
            dummyData.add(packet);
        }
    }

    @Test
    void loadSession_InitializesBufferAndStarts() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);

        replayEngine.loadSession(9165L);

        // Verify it triggers play state (testing internal state via tick effect)
        replayEngine.tick();

        // Since burst rate is 5, it should publish 5 times
        verify(redisTemplate, times(5)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void pauseAndPlay_TogglesSimulationState() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);

        // Pause
        replayEngine.pause();
        replayEngine.tick(); // Should do nothing
        verify(redisTemplate, never()).convertAndSend(anyString(), any(OpenF1CarData.class));

        // Play
        replayEngine.play();
        replayEngine.tick(); // Should burst 5 packets
        verify(redisTemplate, times(5)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_UpdatesIndexCorrectly() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L); // 10 items (indexes 0 to 9)

        // Pause so tick() doesn't auto-advance
        replayEngine.pause();

        // Seek to 50% (should target index 4)
        replayEngine.seek(50);
        replayEngine.play();

        // Tick should process indexes 4, 5, 6, 7, 8
        replayEngine.tick();
        verify(redisTemplate, times(5)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));

        // Tick again should only process index 9 and then auto-pause
        replayEngine.tick();
        verify(redisTemplate, times(6)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }
}
