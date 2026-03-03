package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LiveStreamServiceTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private OpenF1AuthService authService;

    @Test
    void connect_SetsUpCallback_AndParsesTelemetryCorrectly() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");

        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);

            verify(authService, times(1)).getAccessToken();

            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            // Simulate incoming MQTT JSON Message
            String jsonPayload = "{\"driver_number\":1, \"speed\": 320, \"n_gear\": 8}";
            MqttMessage message = new MqttMessage(jsonPayload.getBytes());

            callback.messageArrived("session/9165/car_data", message);

            ArgumentCaptor<OpenF1CarData> carDataCaptor = ArgumentCaptor.forClass(OpenF1CarData.class);
            verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), carDataCaptor.capture());

            OpenF1CarData capturedData = carDataCaptor.getValue();
            assertEquals(1, capturedData.getDriverNumber());
            assertEquals(320, capturedData.getSpeed());
            assertEquals(8, capturedData.getGear());

            // Test that a connection drop triggers a token refresh
            callback.connectionLost(new RuntimeException("Test Disconnect"));
            verify(authService, times(1)).refreshToken();
        }
    }

    @Test
    void connect_ParsesLocationData_WhenTopicIsLocation() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");

        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttClient client = mockedClient.constructed().get(0);
            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            String locationPayload = "{\"driver_number\":44, \"x\": 1456, \"y\": -2340, \"z\": 150}";
            MqttMessage message = new MqttMessage(locationPayload.getBytes());

            callback.messageArrived("session/9165/location", message);

            ArgumentCaptor<OpenF1LocationData> locCaptor = ArgumentCaptor.forClass(OpenF1LocationData.class);
            verify(redisTemplate, times(1)).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), locCaptor.capture());

            OpenF1LocationData capturedLoc = locCaptor.getValue();
            assertEquals(44, capturedLoc.getDriverNumber());
            assertEquals(1456, capturedLoc.getX());
            assertEquals(-2340, capturedLoc.getY());
        }
    }

    @Test
    void connect_IgnoresMessage_WhenTopicIsUnknown() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");

        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttClient client = mockedClient.constructed().get(0);
            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            String payload = "{\"data\":\"test\"}";
            MqttMessage message = new MqttMessage(payload.getBytes());

            callback.messageArrived("session/9165/unknown_topic", message);

            verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any());
            verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.LOCATION_TOPIC), any());
        }
    }

    @Test
    void connect_HandlesInvalidJson_WithoutThrowing() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");

        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttClient client = mockedClient.constructed().get(0);
            ArgumentCaptor<MqttCallback> callbackCaptor = ArgumentCaptor.forClass(MqttCallback.class);
            verify(client).setCallback(callbackCaptor.capture());
            MqttCallback callback = callbackCaptor.getValue();

            MqttMessage message = new MqttMessage("not valid json!!!".getBytes());

            // Should not throw
            callback.messageArrived("session/9165/car_data", message);

            verify(redisTemplate, never()).convertAndSend(eq(RedisConfig.TELEMETRY_TOPIC), any(OpenF1CarData.class));
        }
    }

    @Test
    void connect_HandlesNullAuthToken_GracefullyConnects() throws Exception {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();

        when(authService.getAccessToken()).thenReturn(null);

        LiveStreamService liveStreamService = new LiveStreamService(redisTemplate, jsonMapper, authService);
        ReflectionTestUtils.setField(liveStreamService, "openF1MqttUrl", "tcp://localhost:1883");

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            // Should not throw even without a token
            liveStreamService.connect(9165L);

            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);
            verify(client).connect(any());
        }
    }
}
