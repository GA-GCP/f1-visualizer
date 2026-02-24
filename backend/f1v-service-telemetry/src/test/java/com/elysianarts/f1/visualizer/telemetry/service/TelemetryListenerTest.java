package com.elysianarts.f1.visualizer.telemetry.service;

import com.elysianarts.f1.visualizer.telemetry.config.RedisConfig;
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
    void onMessage_RoutesTelemetry_ToRaceDataTopic() {
        // Arrange
        String jsonPayload = "{\"driver\":\"VER\",\"speed\":320}";
        byte[] body = jsonPayload.getBytes(StandardCharsets.UTF_8);
        byte[] channel = RedisConfig.TELEMETRY_TOPIC.getBytes(StandardCharsets.UTF_8);

        // Mock the Redis Message interface
        Message mockMessage = mock(Message.class);
        when(mockMessage.getBody()).thenReturn(body);

        // CRITICAL FIX: Stub the channel so the Listener knows where it came from
        when(mockMessage.getChannel()).thenReturn(channel);

        // Act
        telemetryListener.onMessage(mockMessage, channel); // The 2nd arg 'pattern' isn't used by our logic, but required by interface

        // Assert
        // Verify we routed to "/topic/race-data"
        verify(messagingTemplate, times(1)).convertAndSend("/topic/race-data", jsonPayload);
    }

    @Test
    void onMessage_RoutesLocation_ToRaceLocationTopic() {
        // Arrange
        String jsonPayload = "{\"driver\":\"VER\",\"x\":100,\"y\":200}";
        byte[] body = jsonPayload.getBytes(StandardCharsets.UTF_8);
        byte[] channel = RedisConfig.LOCATION_TOPIC.getBytes(StandardCharsets.UTF_8);

        // Mock the Redis Message interface
        Message mockMessage = mock(Message.class);
        when(mockMessage.getBody()).thenReturn(body);

        // CRITICAL FIX: Stub the LOCATION channel
        when(mockMessage.getChannel()).thenReturn(channel);

        // Act
        telemetryListener.onMessage(mockMessage, channel);

        // Assert
        // Verify we routed to "/topic/race-location"
        verify(messagingTemplate, times(1)).convertAndSend("/topic/race-location", jsonPayload);
    }
}
