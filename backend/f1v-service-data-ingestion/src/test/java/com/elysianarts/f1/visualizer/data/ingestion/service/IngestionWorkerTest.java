package com.elysianarts.f1.visualizer.data.ingestion.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestionWorkerTest {

    @Mock
    private ReplayEngine replayEngine;

    @Mock
    private LiveStreamService liveStreamService;

    @InjectMocks
    private IngestionWorker ingestionWorker;

    @Test
    void runLoop_TicksReplayEngine_WhenInSimulationMode() {
        // Act: Mode defaults to SIMULATION upon initialization
        ingestionWorker.runLoop();

        // Assert
        verify(replayEngine, times(1)).tick();
        verifyNoInteractions(liveStreamService);
    }

    @Test
    void startSimulation_LoadsSessionIntoReplayEngine() {
        // Arrange
        long sessionKey = 1234L;

        // Act
        ingestionWorker.startSimulation(sessionKey);

        // Assert
        verify(replayEngine, times(1)).loadSession(sessionKey);
    }

    @Test
    void startLiveStream_ConnectsToLiveStreamService_AndStopsReplayTicking() {
        // Arrange
        long sessionKey = 9999L;

        // Act
        ingestionWorker.startLiveStream(sessionKey);

        // Trigger the run loop to verify it ignores the replay engine in LIVE mode
        ingestionWorker.runLoop();

        // Assert
        verify(liveStreamService, times(1)).connect(sessionKey);
        verify(replayEngine, never()).tick(); // Shouldn't tick in LIVE mode
    }

    @Test
    void startSimulation_SwitchesBackFromLive_WhenCalledAfterLiveStream() {
        // Start in live mode
        ingestionWorker.startLiveStream(9999L);
        ingestionWorker.runLoop();
        verify(replayEngine, never()).tick();

        // Switch back to simulation
        ingestionWorker.startSimulation(1234L);
        ingestionWorker.runLoop();

        // Now replay engine should tick again
        verify(replayEngine, times(1)).tick();
    }

    @Test
    void runLoop_DoesNotCallLiveStreamConnect_WhenInSimulationMode() {
        // Default mode is SIMULATION
        ingestionWorker.runLoop();
        ingestionWorker.runLoop();
        ingestionWorker.runLoop();

        verify(replayEngine, times(3)).tick();
        verifyNoInteractions(liveStreamService);
    }
}
