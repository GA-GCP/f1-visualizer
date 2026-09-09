package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReplayTickerTest {

    @Mock
    private ReplayEngine replayEngine;

    @Mock
    private LiveStreamService liveStreamService;

    @Mock
    private ReplayStateStore stateStore;

    @InjectMocks
    private ReplayTicker replayTicker;

    private static final OffsetDateTime CLOCK = OffsetDateTime.of(2023, 9, 17, 12, 30, 0, 0, ZoneOffset.UTC);

    @BeforeEach
    void stubSnapshot() {
        lenient().when(replayEngine.snapshot())
                .thenReturn(new ReplayEngine.Snapshot(9165L, CLOCK, true, 42));
    }

    @Test
    void runLoop_TicksReplayEngine_WhenInSimulationMode() {
        replayTicker.runLoop();

        verify(replayEngine, times(1)).tick();
        verifyNoInteractions(liveStreamService);
    }

    @Test
    void startSimulation_LoadsSessionIntoReplayEngine() {
        replayTicker.startSimulation(1234L);

        verify(replayEngine, times(1)).loadSession(1234L);
    }

    @Test
    void startLiveStream_ConnectsToLiveStreamService_AndStopsReplayTicking() {
        replayTicker.startLiveStream(9999L);
        replayTicker.runLoop();

        verify(liveStreamService, times(1)).connect(9999L);
        verify(replayEngine, never()).tick();
    }

    @Test
    void startSimulation_SwitchesBackFromLive_WhenCalledAfterLiveStream() {
        replayTicker.startLiveStream(9999L);
        replayTicker.runLoop();
        verify(replayEngine, never()).tick();

        replayTicker.startSimulation(1234L);
        replayTicker.runLoop();

        verify(replayEngine, times(1)).tick();
    }

    // ── R1: the state that used to live only in this JVM ──

    @Test
    void startSimulation_PublishesTheStateToRedis() {
        replayTicker.startSimulation(9165L);

        ArgumentCaptor<ReplayState> captor = ArgumentCaptor.captor();
        verify(stateStore, atLeastOnce()).save(captor.capture());

        ReplayState published = captor.getValue();
        assertEquals(ReplayState.Mode.SIMULATION, published.mode());
        assertEquals(9165L, published.sessionKey());
        assertEquals(42, published.progress());
        assertTrue(published.running());
        assertEquals(CLOCK.toString(), published.virtualClock());
    }

    @Test
    void startLiveStream_PublishesLiveMode() {
        replayTicker.startLiveStream(9999L);

        ArgumentCaptor<ReplayState> captor = ArgumentCaptor.captor();
        verify(stateStore, atLeastOnce()).save(captor.capture());
        assertEquals(ReplayState.Mode.LIVE, captor.getValue().mode());
    }

    /** A deploy used to end the session silently. */
    @Test
    void resumeFromLastKnownState_ReloadsAndSeeks_ThenLeavesItPaused() {
        when(stateStore.load()).thenReturn(
                new ReplayState(ReplayState.Mode.SIMULATION, 9165L, CLOCK.toString(), true, 37, null));

        replayTicker.resumeFromLastKnownState();

        verify(replayEngine).loadSession(9165L);
        verify(replayEngine).seek(37);
        // A viewer should press play, not find the session already moving after a
        // deploy they did not see.
        verify(replayEngine).pause();
    }

    @Test
    void resumeFromLastKnownState_DoesNothing_WhenThereWasNoSession() {
        when(stateStore.load()).thenReturn(ReplayState.idle());

        replayTicker.resumeFromLastKnownState();

        verify(replayEngine, never()).loadSession(anyLong());
    }

    /** Losing a status update must not stop the replay it describes. */
    @Test
    void runLoop_KeepsTicking_WhenTheStateStoreFails() {
        doThrow(new IllegalStateException("Redis is down")).when(stateStore).save(any());

        assertDoesNotThrow(() -> replayTicker.startSimulation(9165L));
        verify(replayEngine).loadSession(9165L);
    }
}
