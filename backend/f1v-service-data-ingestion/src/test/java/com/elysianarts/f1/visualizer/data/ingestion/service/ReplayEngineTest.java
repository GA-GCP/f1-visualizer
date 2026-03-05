package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.ReplayChunk;
import com.elysianarts.f1.visualizer.data.ingestion.model.SessionBounds;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReplayEngineTest {

    @Mock
    private ChunkLoader chunkLoader;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    private ReplayEngine replayEngine;

    private OffsetDateTime baseTime;

    @BeforeEach
    void setUp() {
        replayEngine = new ReplayEngine(chunkLoader, redisTemplate);
        baseTime = OffsetDateTime.of(2023, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC);
    }

    // --- Helper methods ---

    private SessionBounds bounds(OffsetDateTime start, OffsetDateTime end) {
        return new SessionBounds(9165, start, end);
    }

    private ReplayChunk chunk(OffsetDateTime start, OffsetDateTime end,
                               List<OpenF1CarData> telemetry, List<OpenF1LocationData> locations) {
        return new ReplayChunk(start, end,
            Collections.unmodifiableList(telemetry),
            Collections.unmodifiableList(locations));
    }

    private List<OpenF1CarData> telemetryPackets(int count, long intervalMs) {
        List<OpenF1CarData> packets = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            OpenF1CarData p = new OpenF1CarData();
            p.setDriverNumber(1);
            p.setSpeed(100 + i);
            p.setDate(baseTime.plusNanos(i * intervalMs * 1_000_000L));
            packets.add(p);
        }
        return packets;
    }

    private List<OpenF1LocationData> locationPackets(int count, long intervalMs) {
        List<OpenF1LocationData> packets = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            OpenF1LocationData p = new OpenF1LocationData();
            p.setDriverNumber(1);
            p.setX(1000 + i * 10);
            p.setY(2000 + i * 10);
            p.setZ(150);
            p.setDate(baseTime.plusNanos(i * intervalMs * 1_000_000L));
            packets.add(p);
        }
        return packets;
    }

    private void setupSingleChunkSession() {
        // Session is 30 seconds (shorter than chunk duration of 60s), so only one chunk
        OffsetDateTime sessionEnd = baseTime.plusSeconds(30);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        // 10 telemetry packets at 100ms intervals
        List<OpenF1CarData> tel = telemetryPackets(10, 100);
        // 5 location packets at 200ms intervals
        List<OpenF1LocationData> loc = locationPackets(5, 200);

        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, tel, loc);

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);
    }

    // --- Loading tests ---

    @Test
    void loadSession_FetchesBoundsAndFirstChunk() {
        setupSingleChunkSession();

        replayEngine.loadSession(9165);

        verify(chunkLoader).fetchBounds(9165);
        verify(chunkLoader).fetchChunkSync(eq(9165L), eq(baseTime), any());
    }

    @Test
    void loadSession_HandlesNullBounds_Gracefully() {
        when(chunkLoader.fetchBounds(9999)).thenReturn(null);

        replayEngine.loadSession(9999);

        // tick should be a no-op
        replayEngine.tick();
        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void loadSession_ClearsExistingState_BeforeLoading() {
        setupSingleChunkSession();
        replayEngine.loadSession(9165);
        replayEngine.tick(); // consume some data

        // Set up a different session
        OffsetDateTime newBase = baseTime.plusHours(1);
        OffsetDateTime newEnd = newBase.plusSeconds(30);
        SessionBounds newBounds = bounds(newBase, newEnd);

        OpenF1CarData newPacket = new OpenF1CarData();
        newPacket.setDriverNumber(44);
        newPacket.setSpeed(310);
        newPacket.setDate(newBase);
        ReplayChunk newChunk = chunk(newBase, newEnd, List.of(newPacket), List.of());

        when(chunkLoader.fetchBounds(9472)).thenReturn(newBounds);
        when(chunkLoader.fetchChunkSync(eq(9472L), eq(newBase), eq(newEnd))).thenReturn(newChunk);

        replayEngine.loadSession(9472);
        replayEngine.tick();

        // Verify driver 44 data was sent
        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC),
            argThat(arg -> arg instanceof OpenF1CarData && ((OpenF1CarData) arg).getDriverNumber() == 44));
    }

    // --- Tick/Playback tests ---

    @Test
    void tick_EmitsTelemetryAndLocationWithinTimeWindow() {
        setupSingleChunkSession();
        replayEngine.loadSession(9165);

        // Tick advances clock by 250ms.
        // Telemetry packets at T+0, T+100, T+200 should be emitted.
        replayEngine.tick();

        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
        // Location packets at T+0, T+200 should be emitted.
        verify(redisTemplate, times(2)).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), any(OpenF1LocationData.class));
    }

    @Test
    void tick_BroadcastsProgress() {
        setupSingleChunkSession();
        replayEngine.loadSession(9165);

        replayEngine.tick();

        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.PLAYBACK_TOPIC), any(Map.class));
    }

    @Test
    void tick_DoesNothing_WhenNotRunning() {
        setupSingleChunkSession();
        replayEngine.loadSession(9165);
        replayEngine.pause();

        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void tick_DoesNothing_WhenChunkIsEmpty() {
        when(chunkLoader.fetchBounds(9165)).thenReturn(null);
        replayEngine.loadSession(9165);

        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void tick_PausesWhenSessionFinished() {
        // Create a tiny session with 1 packet at T+0
        OffsetDateTime sessionEnd = baseTime.plus(100, ChronoUnit.MILLIS);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        OpenF1CarData packet = new OpenF1CarData();
        packet.setDriverNumber(1);
        packet.setSpeed(200);
        packet.setDate(baseTime);
        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, List.of(packet), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);
        replayEngine.tick(); // emits packet, finishes session

        // Second tick should do nothing
        replayEngine.tick();

        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    // --- Chunk transition tests ---

    @Test
    void tick_SwapsToNextChunk_WhenCurrentExhausted() {
        // Session is 90 seconds (longer than 60s chunk)
        OffsetDateTime sessionEnd = baseTime.plusSeconds(90);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);
        OffsetDateTime chunk1End = baseTime.plusSeconds(60);

        // First chunk: 1 packet at T+0 (will be consumed in first tick)
        OpenF1CarData p1 = new OpenF1CarData();
        p1.setDriverNumber(1);
        p1.setSpeed(100);
        p1.setDate(baseTime);
        ReplayChunk firstChunk = chunk(baseTime, chunk1End, List.of(p1), List.of());

        // Second chunk: 1 packet at T+60.001s
        OffsetDateTime chunk2Start = chunk1End.plusNanos(1000);
        OpenF1CarData p2 = new OpenF1CarData();
        p2.setDriverNumber(1);
        p2.setSpeed(200);
        p2.setDate(chunk2Start);
        ReplayChunk secondChunk = chunk(chunk2Start, sessionEnd, List.of(p2), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(chunk1End))).thenReturn(firstChunk);

        // Pre-fetch will be triggered — mock it as immediately completed
        when(chunkLoader.fetchChunkAsync(eq(9165L), eq(chunk2Start), eq(sessionEnd)))
            .thenReturn(CompletableFuture.completedFuture(secondChunk));

        replayEngine.loadSession(9165);

        // First tick: consumes packet at T+0, triggers prefetch
        replayEngine.tick();
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));

        // Advance many ticks to reach beyond chunk1End so it swaps
        for (int i = 0; i < 250; i++) { // 250 * 250ms = 62.5 seconds
            replayEngine.tick();
        }

        // The second chunk's packet should eventually be emitted
        verify(redisTemplate, times(2)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void tick_TriggersPrefetchAtThreshold() {
        // Session is 90 seconds
        OffsetDateTime sessionEnd = baseTime.plusSeconds(90);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);
        OffsetDateTime chunk1End = baseTime.plusSeconds(60);

        // First chunk: 2 packets close together so one tick consumes > 50%
        List<OpenF1CarData> telemetry = new ArrayList<>();
        OpenF1CarData p1 = new OpenF1CarData();
        p1.setDriverNumber(1);
        p1.setSpeed(100);
        p1.setDate(baseTime);
        telemetry.add(p1);
        OpenF1CarData p2 = new OpenF1CarData();
        p2.setDriverNumber(1);
        p2.setSpeed(110);
        p2.setDate(baseTime.plus(100, ChronoUnit.MILLIS));
        telemetry.add(p2);

        ReplayChunk firstChunk = chunk(baseTime, chunk1End, telemetry, List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(chunk1End))).thenReturn(firstChunk);

        OffsetDateTime chunk2Start = chunk1End.plusNanos(1000);
        when(chunkLoader.fetchChunkAsync(eq(9165L), eq(chunk2Start), eq(sessionEnd)))
            .thenReturn(new CompletableFuture<>()); // never completes, we just verify it was called

        replayEngine.loadSession(9165);

        // First tick consumes both packets (100% > 50% threshold)
        replayEngine.tick();

        verify(chunkLoader).fetchChunkAsync(eq(9165L), eq(chunk2Start), eq(sessionEnd));
    }

    @Test
    void tick_DoesNotPrefetchOnLastChunk() {
        // Session fits in one chunk (30s < 60s chunk duration)
        setupSingleChunkSession();
        replayEngine.loadSession(9165);

        replayEngine.tick(); // consumes packets

        verify(chunkLoader, never()).fetchChunkAsync(anyLong(), any(), any());
    }

    // --- Seek tests ---

    @Test
    void seek_LoadsCorrectChunkForPercentage() {
        // Session is 120 seconds (2 full chunks)
        OffsetDateTime sessionEnd = baseTime.plusSeconds(120);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);
        OffsetDateTime chunk1End = baseTime.plusSeconds(60);

        // First chunk for initial load
        ReplayChunk firstChunk = chunk(baseTime, chunk1End, telemetryPackets(3, 100), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(chunk1End))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);

        // Seek to 75% — target time is T+90s, which falls in chunk [T+60s, T+120s]
        OffsetDateTime seekChunkStart = baseTime.plusSeconds(60);
        OffsetDateTime seekChunkEnd = sessionEnd;

        OpenF1CarData seekPacket = new OpenF1CarData();
        seekPacket.setDriverNumber(1);
        seekPacket.setSpeed(300);
        seekPacket.setDate(baseTime.plusSeconds(90));
        ReplayChunk seekChunk = chunk(seekChunkStart, seekChunkEnd, List.of(seekPacket), List.of());

        when(chunkLoader.fetchChunkSync(eq(9165L), eq(seekChunkStart), eq(seekChunkEnd))).thenReturn(seekChunk);

        replayEngine.seek(75);

        // Verify the seek chunk was fetched
        verify(chunkLoader).fetchChunkSync(eq(9165L), eq(seekChunkStart), eq(seekChunkEnd));
    }

    @Test
    void seek_ClampsNegativePercentage() {
        // Session: 30 seconds
        OffsetDateTime sessionEnd = baseTime.plusSeconds(30);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, telemetryPackets(3, 100), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);

        // Seek to -50% should clamp to 0%
        replayEngine.seek(-50);
        replayEngine.play();
        replayEngine.tick();

        // Should emit packets from the beginning
        verify(redisTemplate, atLeastOnce()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_ClampsOver100Percentage() {
        OffsetDateTime sessionEnd = baseTime.plusSeconds(30);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        OpenF1CarData lastPacket = new OpenF1CarData();
        lastPacket.setDriverNumber(1);
        lastPacket.setSpeed(300);
        lastPacket.setDate(sessionEnd.minus(10, ChronoUnit.MILLIS));
        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, List.of(lastPacket), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);

        // Seek to 200% should clamp to 100%
        replayEngine.seek(200);
        replayEngine.play(); // play() won't resume since virtualClock >= endTime
        replayEngine.tick();

        // No new telemetry should be emitted (play guard prevents it)
        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void seek_DoesNothing_WhenNoBoundsLoaded() {
        when(chunkLoader.fetchBounds(9999)).thenReturn(null);
        replayEngine.loadSession(9999);

        // Should not throw
        replayEngine.seek(50);
        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    // --- Pause/Play tests ---

    @Test
    void pauseAndPlay_TogglesSimulationState() {
        setupSingleChunkSession();
        replayEngine.loadSession(9165);

        // Pause
        replayEngine.pause();
        replayEngine.tick();
        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));

        // Play
        replayEngine.play();
        replayEngine.tick();
        verify(redisTemplate, times(3)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    @Test
    void play_DoesNotResume_WhenSessionFinished() {
        OffsetDateTime sessionEnd = baseTime.plus(100, ChronoUnit.MILLIS);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        OpenF1CarData packet = new OpenF1CarData();
        packet.setDriverNumber(1);
        packet.setSpeed(200);
        packet.setDate(baseTime);
        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, List.of(packet), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);
        replayEngine.tick(); // consumes all, finishes session

        replayEngine.pause();
        replayEngine.play(); // should NOT resume
        replayEngine.tick();

        // Only 1 telemetry send total (from the first tick only)
        verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }

    // --- Progress tests ---

    @Test
    void calculateProgress_ReturnsTimeBasedPercentage() {
        // Session is 50 seconds (fits in one 60s chunk)
        OffsetDateTime sessionEnd = baseTime.plusSeconds(50);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, telemetryPackets(3, 100), locationPackets(2, 200));

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);

        // After one tick (250ms into a 50s session), progress ≈ 0%
        replayEngine.tick();

        int progress = replayEngine.calculateProgress();
        assertTrue(progress <= 1, "Progress should be near 0%, was: " + progress);
    }

    // --- Seek with location index positioning ---

    @Test
    void seek_PositionsLocationIndexCorrectly() {
        OffsetDateTime sessionEnd = baseTime.plusSeconds(30);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        List<OpenF1CarData> tel = telemetryPackets(10, 100);
        List<OpenF1LocationData> loc = locationPackets(5, 200);

        ReplayChunk firstChunk = chunk(baseTime, sessionEnd, tel, loc);

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(firstChunk);

        replayEngine.loadSession(9165);
        replayEngine.pause();

        // Seek to 50% = T+15s — all packets are within first second
        // So all packets should be positioned past
        replayEngine.seek(50);
        replayEngine.play();
        replayEngine.tick();

        // No new location packets within T+15s..T+15.25s window
        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), any(OpenF1LocationData.class));
    }

    @Test
    void loadSession_HandlesEmptyTelemetryFromRepository() {
        OffsetDateTime sessionEnd = baseTime.plusSeconds(30);
        SessionBounds sessionBounds = bounds(baseTime, sessionEnd);

        ReplayChunk emptyChunk = chunk(baseTime, sessionEnd, List.of(), List.of());

        when(chunkLoader.fetchBounds(9165)).thenReturn(sessionBounds);
        when(chunkLoader.fetchChunkSync(eq(9165L), eq(baseTime), eq(sessionEnd))).thenReturn(emptyChunk);

        replayEngine.loadSession(9165);
        replayEngine.tick();

        verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
    }
}
