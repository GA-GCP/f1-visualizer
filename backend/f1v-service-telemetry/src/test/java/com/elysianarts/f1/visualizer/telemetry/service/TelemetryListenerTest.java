package com.elysianarts.f1.visualizer.telemetry.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TelemetryListenerTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private TelemetryListener telemetryListener;

    @Test
    void onMessage_BroadcastsPayloadToWebSocket() {
        // Arrange
        String jsonPayload = "{\"driver\":\"VER\",\"speed\":320}";
        byte[] body = jsonPayload.getBytes(StandardCharsets.UTF_8);
        byte[] channel = "live_telemetry".getBytes(StandardCharsets.UTF_8);

        // Mock the Redis Message interface
        Message mockMessage = mock(Message.class);
        when(mockMessage.getBody()).thenReturn(body);

        // Act
        telemetryListener.onMessage(mockMessage, channel);

        // Assert
        // Verify we sent the EXACT payload to the EXACT WebSocket topic
        verify(messagingTemplate, times(1)).convertAndSend("/topic/race-data", jsonPayload);
    }
}
