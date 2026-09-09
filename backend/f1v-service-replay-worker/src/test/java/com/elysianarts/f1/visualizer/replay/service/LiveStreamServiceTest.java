package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.elysianarts.f1.visualizer.commons.messaging.redis.RedisTopics;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
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

import java.util.List;

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

    private final MeterRegistry meterRegistry = new SimpleMeterRegistry();

    private LiveStreamService newService() {
        JsonMapper jsonMapper = JsonMapper.builder().findAndAddModules().build();
        LiveStreamService service = new LiveStreamService(redisTemplate, jsonMapper, authService, meterRegistry);
        ReflectionTestUtils.setField(service, "openF1MqttUrl", "tcp://localhost:1883");
        return service;
    }

    private static MqttCallbackExtended callbackOf(MqttClient client) {
        ArgumentCaptor<MqttCallbackExtended> captor = ArgumentCaptor.forClass(MqttCallbackExtended.class);
        verify(client).setCallback(captor.capture());
        return captor.getValue();
    }

    @Test
    void connect_SetsUpCallback_AndParsesTelemetryCorrectly() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);

            verify(authService, times(1)).getAccessToken();

            MqttCallbackExtended callback = callbackOf(client);

            // Simulate incoming MQTT JSON Message
            String jsonPayload = "{\"driver_number\":1, \"speed\": 320, \"n_gear\": 8}";
            MqttMessage message = new MqttMessage(jsonPayload.getBytes());

            callback.messageArrived("session/9165/car_data", message);

            // P1: one message per channel, carrying the packets as an array.
            ArgumentCaptor<List<OpenF1CarData>> carDataCaptor = ArgumentCaptor.captor();
            verify(redisTemplate, times(1)).convertAndSend(eq(RedisTopics.TELEMETRY), carDataCaptor.capture());

            OpenF1CarData capturedData = carDataCaptor.getValue().get(0);
            assertEquals(1, capturedData.getDriverNumber());
            assertEquals(320, capturedData.getSpeed());
            assertEquals(8, capturedData.getGear());
        }
    }

    @Test
    void connect_SubscribesToBothSessionTopics() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttClient client = mockedClient.constructed().get(0);
            verify(client).subscribe("session/9165/car_data", 1);
            verify(client).subscribe("session/9165/location", 1);
        }
    }

    /**
     * R2: a clean session drops its subscriptions on every disconnect, so a
     * reconnect that does not re-subscribe leaves the feed silent with no error.
     */
    @Test
    void connectComplete_ReSubscribes_WhenPahoReconnects() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttClient client = mockedClient.constructed().get(0);
            MqttCallbackExtended callback = callbackOf(client);

            callback.connectComplete(true, "tcp://localhost:1883");

            // Once for the initial connect, once for the reconnect.
            verify(client, times(2)).subscribe("session/9165/car_data", 1);
            verify(client, times(2)).subscribe("session/9165/location", 1);
            assertEquals(1.0, meterRegistry.get("f1v.mqtt.reconnects").counter().count());
        }
    }

    /**
     * R2: Paho retries with the options it was originally handed, so an expired
     * token can only be recovered by rebuilding the client.
     *
     * <p>The rebuild is driven directly rather than through {@code connectionLost}
     * because Mockito's {@code mockConstruction} is scoped to the calling thread,
     * and the production path deliberately hands the blocking {@code connect()} to
     * a separate executor. {@link #connectionLost_RefreshesTheToken} covers the
     * hand-off.</p>
     */
    @Test
    void reconnectWithFreshToken_RebuildsConnection_WhenTokenChanged() throws Exception {
        when(authService.getAccessToken()).thenReturn("stale-token", "fresh-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            liveStreamService.reconnectWithFreshToken();

            // A second client is constructed with the refreshed credential, and it
            // re-subscribes to the session it was already following.
            assertEquals(2, mockedClient.constructed().size());
            verify(mockedClient.constructed().get(1)).connect(any());
            verify(mockedClient.constructed().get(1)).subscribe("session/9165/car_data", 1);
        }
    }

    /**
     * A transient blip with an unchanged token is Paho's automatic reconnect to
     * handle; tearing the client down would be a regression.
     */
    @Test
    void reconnectWithFreshToken_LeavesClientAlone_WhenTokenUnchanged() throws Exception {
        when(authService.getAccessToken()).thenReturn("same-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            liveStreamService.reconnectWithFreshToken();

            assertEquals(1, mockedClient.constructed().size());
        }
    }

    /** The drop itself only refreshes the token; the blocking rebuild is handed off. */
    @Test
    void connectionLost_RefreshesTheToken() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);
            MqttCallbackExtended callback = callbackOf(mockedClient.constructed().get(0));

            callback.connectionLost(new RuntimeException("Test Disconnect"));

            verify(authService, timeout(2000)).refreshToken();
        }
    }

    /** A second command must not leave the previous client and its retry loop running. */
    @Test
    void connect_ClosesPreviousClient_WhenCalledAgain() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);
            liveStreamService.connect(9166L);

            assertEquals(2, mockedClient.constructed().size());
            verify(mockedClient.constructed().get(0)).close(true);
            verify(mockedClient.constructed().get(1)).subscribe("session/9166/car_data", 1);
        }
    }

    @Test
    void connect_ParsesLocationData_WhenTopicIsLocation() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttCallbackExtended callback = callbackOf(mockedClient.constructed().get(0));

            String locationPayload = "{\"driver_number\":44, \"x\": 1456, \"y\": -2340, \"z\": 150}";
            MqttMessage message = new MqttMessage(locationPayload.getBytes());

            callback.messageArrived("session/9165/location", message);

            ArgumentCaptor<List<OpenF1LocationData>> locCaptor = ArgumentCaptor.captor();
            verify(redisTemplate, times(1)).convertAndSend(eq(RedisTopics.LOCATION), locCaptor.capture());

            OpenF1LocationData capturedLoc = locCaptor.getValue().get(0);
            assertEquals(44, capturedLoc.getDriverNumber());
            assertEquals(1456, capturedLoc.getX());
            assertEquals(-2340, capturedLoc.getY());
        }
    }

    @Test
    void connect_IgnoresMessage_WhenTopicIsUnknown() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttCallbackExtended callback = callbackOf(mockedClient.constructed().get(0));

            MqttMessage message = new MqttMessage("{\"data\":\"test\"}".getBytes());
            callback.messageArrived("session/9165/unknown_topic", message);

            verify(redisTemplate, never()).convertAndSend(eq(RedisTopics.TELEMETRY), any());
            verify(redisTemplate, never()).convertAndSend(eq(RedisTopics.LOCATION), any());
        }
    }

    @Test
    void connect_HandlesInvalidJson_WithoutThrowing() throws Exception {
        when(authService.getAccessToken()).thenReturn("mock-sponsor-token");
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            liveStreamService.connect(9165L);

            MqttCallbackExtended callback = callbackOf(mockedClient.constructed().get(0));

            MqttMessage message = new MqttMessage("not valid json!!!".getBytes());

            // Should not throw
            callback.messageArrived("session/9165/car_data", message);

            verify(redisTemplate, never()).convertAndSend(eq(RedisTopics.TELEMETRY), any());
        }
    }

    @Test
    void connect_HandlesNullAuthToken_GracefullyConnects() throws Exception {
        when(authService.getAccessToken()).thenReturn(null);
        LiveStreamService liveStreamService = newService();

        try (MockedConstruction<MqttClient> mockedClient = mockConstruction(MqttClient.class)) {
            // Should not throw even without a token
            liveStreamService.connect(9165L);

            assertEquals(1, mockedClient.constructed().size());
            MqttClient client = mockedClient.constructed().get(0);
            verify(client).connect(any());
        }
    }
}
