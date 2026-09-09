package com.elysianarts.f1.visualizer.replay.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.elysianarts.f1.visualizer.commons.messaging.redis.RedisTopics;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Bridges the OpenF1 MQTT live feed onto Redis pub/sub.
 *
 * <p><b>Reconnect contract (R2).</b> The connection is opened with {@code cleanSession=true}, which
 * means the broker discards subscriptions on every disconnect. Paho's {@code automaticReconnect}
 * restores the <em>session</em> but not the subscriptions, so {@link
 * MqttCallbackExtended#connectComplete} re-subscribes on every successful connect — the original
 * code implemented the plain {@code MqttCallback}, so after the first dropped connection the feed
 * went silent with no error at all.
 *
 * <p>Paho also retries with the connect options it was originally given, so once the OpenF1 token
 * expires every automatic retry fails with the stale password. {@code connectionLost} therefore
 * refreshes the token and, if it actually changed, rebuilds the client with fresh options rather
 * than leaving Paho to retry a credential that can no longer succeed.
 */
@Slf4j
@Service
public class LiveStreamService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final JsonMapper jsonMapper;
    private final OpenF1AuthService authService;
    private final Counter reconnectCounter;

    /** Rebuilds happen off the Paho callback thread — connect() blocks. */
    private final ExecutorService reconnectExecutor =
            Executors.newSingleThreadExecutor(
                    r -> {
                        Thread t = new Thread(r, "mqtt-reconnect");
                        t.setDaemon(true);
                        return t;
                    });

    @Value("${f1v.mqtt.url:wss://mqtt.openf1.org:443}")
    private String openF1MqttUrl;

    private final Object lock = new Object();
    private MqttClient mqttClient;
    private volatile long currentSessionKey;

    /** The token the live connect options were built with, so a refresh is detectable. */
    private volatile String connectedWithToken;

    public LiveStreamService(
            RedisTemplate<String, Object> redisTemplate,
            JsonMapper jsonMapper,
            OpenF1AuthService authService,
            MeterRegistry meterRegistry) {
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.authService = authService;
        this.reconnectCounter =
                Counter.builder("f1v.mqtt.reconnects")
                        .description("MQTT connections lost and re-established since start")
                        .register(meterRegistry);
    }

    public void connect(long sessionKey) {
        synchronized (lock) {
            this.currentSessionKey = sessionKey;
            log.info("mqtt connect requested session_key={} url={}", sessionKey, openF1MqttUrl);

            // A second command previously leaked the old client, which kept its
            // subscriptions and its auto-reconnect loop running against the
            // previous session.
            closeQuietly(mqttClient);

            try {
                String clientId = "f1v-ingest-" + UUID.randomUUID();
                MqttClient client = new MqttClient(openF1MqttUrl, clientId, null);
                client.setCallback(new SessionCallback());

                String token = authService.getAccessToken();
                this.connectedWithToken = token;

                // Published before connect(): Paho can fire connectComplete from
                // inside connect(), and that callback needs to see this client
                // rather than the one being replaced.
                this.mqttClient = client;
                client.connect(buildOptions(token));

                log.info("mqtt connected session_key={} client_id={}", sessionKey, clientId);

                subscribe(client, sessionKey);
            } catch (MqttException e) {
                log.error("mqtt connect failed session_key={}", sessionKey, e);
                throw new IllegalStateException(
                        "Failed to connect to OpenF1 MQTT broker: " + e.getMessage(), e);
            }
        }
    }

    private MqttConnectOptions buildOptions(String token) {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true);
        options.setCleanSession(true);
        options.setConnectionTimeout(10);

        if (token != null) {
            options.setPassword(token.toCharArray());
            options.setUserName("SponsorTier");
        } else {
            log.warn("mqtt connecting without a token — OpenF1 will reject a sponsor-tier session");
        }
        return options;
    }

    /**
     * Re-establishes the subscriptions. Called on the initial connect and again from {@code
     * connectComplete} after every reconnect, because a clean session has none of them left.
     */
    private void subscribe(MqttClient client, long sessionKey) throws MqttException {
        String carDataTopic = "session/" + sessionKey + "/car_data";
        String locationTopic = "session/" + sessionKey + "/location";

        client.subscribe(carDataTopic, 1);
        client.subscribe(locationTopic, 1);

        log.info("mqtt subscribed qos=1 topics=[{},{}]", carDataTopic, locationTopic);
    }

    private void closeQuietly(MqttClient client) {
        if (client == null) return;
        try {
            if (client.isConnected()) {
                client.disconnectForcibly(1000L, 1000L);
            }
            client.close(true);
        } catch (Exception e) {
            log.warn("mqtt close of previous client failed: {}", e.toString());
        }
    }

    /**
     * Rebuilds the connection with a token fetched after the drop. Only worth doing when the token
     * actually moved — otherwise Paho's own retry loop is already doing the right thing and tearing
     * it down would be a regression.
     */
    void reconnectWithFreshToken() {
        String refreshed = authService.getAccessToken();
        if (Objects.equals(refreshed, connectedWithToken)) {
            log.info("mqtt token unchanged after refresh — leaving automatic reconnect to retry");
            return;
        }
        log.info(
                "mqtt token changed after refresh — rebuilding connection session_key={}",
                currentSessionKey);
        try {
            connect(currentSessionKey);
        } catch (RuntimeException e) {
            log.error(
                    "mqtt rebuild with refreshed token failed session_key={}",
                    currentSessionKey,
                    e);
        }
    }

    @PreDestroy
    void shutdown() {
        reconnectExecutor.shutdownNow();
        synchronized (lock) {
            closeQuietly(mqttClient);
            mqttClient = null;
        }
    }

    private final class SessionCallback implements MqttCallbackExtended {

        @Override
        public void connectComplete(boolean reconnect, String serverURI) {
            if (reconnect) {
                reconnectCounter.increment();
                log.info("mqtt reconnected server_uri={} — restoring subscriptions", serverURI);
            }
            MqttClient client = mqttClient;
            if (client == null) return;
            try {
                subscribe(client, currentSessionKey);
            } catch (MqttException e) {
                log.error(
                        "mqtt re-subscribe failed after connect session_key={}",
                        currentSessionKey,
                        e);
            }
        }

        @Override
        public void connectionLost(Throwable cause) {
            log.warn(
                    "mqtt connection lost session_key={} — refreshing token",
                    currentSessionKey,
                    cause);
            // connect() blocks, and Paho forbids blocking work on this thread.
            reconnectExecutor.execute(
                    () -> {
                        authService.refreshToken();
                        reconnectWithFreshToken();
                    });
        }

        @Override
        public void messageArrived(String topic, MqttMessage message) {
            try {
                String payload = new String(message.getPayload());

                // Published as a one-element array so the live and replay paths
                // put the same shape on the wire: the browser parses one contract
                // rather than two (P1).
                if (topic.endsWith("/car_data")) {
                    OpenF1CarData carData = jsonMapper.readValue(payload, OpenF1CarData.class);
                    redisTemplate.convertAndSend(RedisTopics.TELEMETRY, List.of(carData));
                } else if (topic.endsWith("/location")) {
                    OpenF1LocationData locData =
                            jsonMapper.readValue(payload, OpenF1LocationData.class);
                    redisTemplate.convertAndSend(RedisTopics.LOCATION, List.of(locData));
                }
            } catch (Exception e) {
                log.error("mqtt payload parse failed topic={}", topic, e);
            }
        }

        @Override
        public void deliveryComplete(IMqttDeliveryToken token) {
            // Ingest-only client: nothing is published to the broker.
        }
    }
}
