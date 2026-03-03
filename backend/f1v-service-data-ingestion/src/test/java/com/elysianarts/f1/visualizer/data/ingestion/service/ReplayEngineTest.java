package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
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
    private List<OpenF1LocationData> dummyLocationData;
    private OffsetDateTime baseTime;

    @BeforeEach
    void setUp() {
        baseTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
        dummyData = new ArrayList<>();

        // Create 10 dummy packets spaced by 100ms each
        for (int i = 0; i < 10; i++) {
            OpenF1CarData packet = new OpenF1CarData();
            packet.setDriverNumber(1);
            packet.setSpeed(100 + i);
            packet.setDate(baseTime.plusNanos(i * 100_000_000L));
            dummyData.add(packet);
        }

        // Create 5 location packets spaced by 200ms each
        dummyLocationData = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            OpenF1LocationData loc = new OpenF1LocationData();
            loc.setDriverNumber(1);
            loc.setX(1000 + i * 10);
            loc.setY(2000 + i * 10);
            loc.setZ(150);
            loc.setDate(baseTime.plusNanos(i * 200_000_000L));
            dummyLocationData.add(loc);
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

    @Test
    void tick_DoesNothing_WhenBufferIsEmpty() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(Collections.emptyList());

        replayEngine.loadSession(9165L);
        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void tick_SetsIsRunningFalse_WhenAllPacketsConsumed() {
        // Create a small buffer with only 2 packets within one tick window
        List<OpenF1CarData> smallBuffer = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            OpenF1CarData packet = new OpenF1CarData();
            packet.setDriverNumber(1);
            packet.setSpeed(200);
            packet.setDate(baseTime.plusNanos(i * 50_000_000L)); // 50ms apart
            smallBuffer.add(packet);
        }

        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(smallBuffer);
        replayEngine.loadSession(9165L);

        // First tick consumes all 2 packets (both within 250ms window)
        replayEngine.tick();

        // Second tick should do nothing because isRunning is now false
        replayEngine.tick();

        // Only 2 telemetry sends total (from the first tick)
        verify(redisTemplate, times(2)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void tick_PublishesLocationPackets_WhenLocationDataExists() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        when(historicalLocationRepository.fetchSessionLocations(9165L)).thenReturn(dummyLocationData);

        replayEngine.loadSession(9165L);

        // First tick: virtual clock advances by 250ms from T+0
        // Location packets at T+0ms and T+200ms should be published
        replayEngine.tick();

        verify(redisTemplate, times(2)).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), any(OpenF1LocationData.class));
    }

    @Test
    void tick_BroadcastsProgress_OnEveryTick() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);

        replayEngine.tick();

        // Verify progress was broadcast to the playback topic
        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.PLAYBACK_TOPIC), any(Map.class));
    }

    @Test
    void play_DoesNotResume_WhenAtEndOfBuffer() {
        // Create a small buffer that will be fully consumed in one tick
        List<OpenF1CarData> smallBuffer = new ArrayList<>();
        OpenF1CarData packet = new OpenF1CarData();
        packet.setDriverNumber(1);
        packet.setSpeed(200);
        packet.setDate(baseTime);
        smallBuffer.add(packet);

        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(smallBuffer);
        replayEngine.loadSession(9165L);

        // Consume all packets
        replayEngine.tick();

        // Pause, then try to play - should not resume since we're at end
        replayEngine.pause();
        replayEngine.play();
        replayEngine.tick();

        // Only 1 telemetry send (from the first tick only)
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_ClampsTo0_WhenNegativePercentage() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);
        replayEngine.pause();

        // Seek with negative percentage should clamp to 0
        replayEngine.seek(-50);
        replayEngine.play();

        // After seeking to 0%, tick should process from the beginning (T+0ms)
        // Tick advances by 250ms -> processes packets at T+0, T+100, T+200
        replayEngine.tick();
        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_ClampsTo100_WhenOver100Percentage() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);
        replayEngine.pause();

        // Seek with >100 percentage should clamp to 100% (index 9, the last packet at T+900ms)
        replayEngine.seek(200);
        replayEngine.play();

        // After seeking to 100% (index 9 at T+900ms), tick advances 250ms to T+1150ms
        // Only the last packet (index 9) should be within the window
        replayEngine.tick();
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_DoesNothing_WhenBufferIsEmpty() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(Collections.emptyList());
        replayEngine.loadSession(9165L);

        // Should not throw
        replayEngine.seek(50);
        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_SyncsLocationIndex_ToVirtualClock() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        when(historicalLocationRepository.fetchSessionLocations(9165L)).thenReturn(dummyLocationData);

        replayEngine.loadSession(9165L);
        replayEngine.pause();

        // Seek to 50% (index 4 at T+400ms)
        // Location packets: T+0, T+200, T+400 should all be at or before virtualClock
        // So locationIndex should sync to 3 (past packets at 0, 200, 400)
        replayEngine.seek(50);
        replayEngine.play();

        // Tick from T+400ms + 250ms = T+650ms
        // Location packet at T+600ms (index 3) should be published
        replayEngine.tick();

        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), any(OpenF1LocationData.class));
    }

    @Test
    void loadSession_ClearsExistingBuffer_BeforeLoadingNew() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(dummyData);
        replayEngine.loadSession(9165L);

        // Advance a few ticks
        replayEngine.tick();

        // Create different data for second session
        List<OpenF1CarData> newData = new ArrayList<>();
        OpenF1CarData packet = new OpenF1CarData();
        packet.setDriverNumber(44);
        packet.setSpeed(310);
        packet.setDate(baseTime);
        newData.add(packet);

        when(historicalRepository.fetchSessionTelemetry(9472L)).thenReturn(newData);

        // Load a new session - should reset state
        replayEngine.loadSession(9472L);
        replayEngine.tick();

        // Verify driver 44 data was sent (from the second session)
        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), argThat(arg ->
                arg instanceof OpenF1CarData && ((OpenF1CarData) arg).getDriverNumber() == 44));
    }

    @Test
    void loadSession_HandlesEmptyTelemetryFromRepository() {
        when(historicalRepository.fetchSessionTelemetry(9165L)).thenReturn(Collections.emptyList());
        when(historicalLocationRepository.fetchSessionLocations(9165L)).thenReturn(Collections.emptyList());

        // Should not throw
        replayEngine.loadSession(9165L);

        // Tick should be a no-op
        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }
}
