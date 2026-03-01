package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

@Slf4j
@Service
public class LiveStreamService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final JsonMapper jsonMapper;
    private final OpenF1AuthService authService; // <-- Inject Auth Service

    @Value("${f1v.mqtt.url:wss://mqtt.openf1.org:443}")
    private String openF1MqttUrl;

    private MqttClient mqttClient;
    private long currentSessionKey;

    public LiveStreamService(RedisTemplate<String, Object> redisTemplate, JsonMapper jsonMapper, OpenF1AuthService authService) {
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.authService = authService;
    }

    public void connect(long sessionKey) {
        this.currentSessionKey = sessionKey;
        log.info("🔌 Connecting to OpenF1 Pro MQTT Stream for Session: {} at {}", sessionKey, openF1MqttUrl);

        try {
            String clientId = "f1v-ingest-" + UUID.randomUUID().toString();
            mqttClient = new MqttClient(openF1MqttUrl, clientId, null);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            options.setConnectionTimeout(10);

            // If the MQTT broker requires token authentication as a password:
            String token = authService.getAccessToken();
            if (token != null) {
                options.setPassword(token.toCharArray());
                options.setUserName("SponsorTier");
            }

            mqttClient.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("⚠️ MQTT Connection Lost! Refreshing token and attempting reconnect...", cause);
                    // Force a token refresh when we drop, just in case expiry was the cause
                    authService.refreshToken();
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    try {
                        String payload = new String(message.getPayload());

                        if (topic.endsWith("/car_data")) {
                            OpenF1CarData carData = jsonMapper.readValue(payload, OpenF1CarData.class);
                            redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, carData);
                        } else if (topic.endsWith("/location")) {
                            OpenF1LocationData locData = jsonMapper.readValue(payload, OpenF1LocationData.class);
                            redisTemplate.convertAndSend(RedisConfig.LOCATION_TOPIC, locData);
                        }
                    } catch (Exception e) {
                        log.error("❌ Failed to parse incoming MQTT payload on topic: {}", topic, e);
                    }
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });

            mqttClient.connect(options);
            log.info("✅ Connected to MQTT Broker!");

            String carDataTopic = "session/" + sessionKey + "/car_data";
            String locationTopic = "session/" + sessionKey + "/location";

            // UPGRADED to QoS 1: Guarantee delivery so we don't skip frames on the front-end trace!
            mqttClient.subscribe(carDataTopic, 1);
            mqttClient.subscribe(locationTopic, 1);

            log.info("📡 Subscribed to {} and {} at QoS 1", carDataTopic, locationTopic);

        } catch (MqttException e) {
            log.error("❌ Failed to connect to MQTT broker", e);
        }
    }
}