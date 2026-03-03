package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LiveStreamServiceTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private OpenF1AuthService authService; // <-- NEW: Mock the injected dependency

    @Test
    void connect_SetsUpCallback_AndParsesTelemetryCorrectly() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        // 1. Mock the auth token retrieval
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");

        // 2. Inject authService into the constructor
        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        // Intercept the MqttClient creation
        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {

            // Act
            liveStreamService.connect(9165L);

            // Verify Client was created
            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);

            // Verify it grabbed the token for the MQTT options
            verify(authService, times(1)).getAccessToken();

            // Capture the anonymous callback
            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            // Simulate incoming MQTT JSON Message
            String jsonPayload = "{\"driver_number\":1, \"speed\": 320, \"n_gear\": 8}";
            MqttMessage message = new MqttMessage(jsonPayload.getBytes());

            // Trigger the callback manually
            callback.messageArrived("session/9165/car_data", message);

            // Assert: Verify Jackson parsed it and pushed it to Redis
            ArgumentCaptor<OpenF1CarData> carDataCaptor = ArgumentCaptor.forClass(OpenF1CarData.class);
            verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), carDataCaptor.capture());

            OpenF1CarData capturedData = carDataCaptor.getValue();
            assertEquals(1, capturedData.getDriverNumber());
            assertEquals(320, capturedData.getSpeed());
            assertEquals(8, capturedData.getGear());

            // --- NEW: Test that a connection drop triggers a token refresh ---
            callback.connectionLost(new RuntimeException("Test Disconnect"));
            verify(authService, times(1)).refreshToken();
        }
    }
}