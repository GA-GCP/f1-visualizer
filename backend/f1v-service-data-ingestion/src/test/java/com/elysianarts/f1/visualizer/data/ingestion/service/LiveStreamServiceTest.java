package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
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

    @Test
    void connect_SetsUpCallback_AndParsesTelemetryCorrectly() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().build();
        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        // Intercept the MqttClient creation
        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {

            // Act
            liveStreamService.connect(9165L);

            // Verify Client was created
            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);

            // Capture the anonymous callback
            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            // Simulate incoming MQTT JSON Message
            String jsonPayload = "{\"driver_number\":1, \"speed\": 320, \"gear\": 8}";
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
        }
    }
}
