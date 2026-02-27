package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.config.RedisConfig;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1LocationData;
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

    @Value("${f1v.mqtt.url:wss://mqtt.openf1.org:443}")
    private String openF1MqttUrl;

    private MqttClient mqttClient;

    public LiveStreamService(RedisTemplate<String, Object> redisTemplate, JsonMapper jsonMapper) {
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
    }

    public void connect(long sessionKey) {
        log.info("🔌 Connecting to OpenF1 Pro MQTT Stream for Session: {} at {}", sessionKey, openF1MqttUrl);

        try {
            // Unique Client ID prevents connection collisions
            String clientId = "f1v-ingest-" + UUID.randomUUID().toString();

            // Note: passing null for persistence keeps everything in-memory (ideal for transient streaming)
            mqttClient = new MqttClient(openF1MqttUrl, clientId, null);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            options.setConnectionTimeout(10);

            mqttClient.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("⚠️ MQTT Connection Lost! Reconnecting...", cause);
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
                public void deliveryComplete(IMqttDeliveryToken token) {
                    // We only subscribe, we do not publish back to OpenF1
                }
            });

            mqttClient.connect(options);
            log.info("✅ Connected to MQTT Broker!");

            // Subscribe to Telemetry and Location topics dynamically based on the requested session
            String carDataTopic = "session/" + sessionKey + "/car_data";
            String locationTopic = "session/" + sessionKey + "/location";

            mqttClient.subscribe(carDataTopic, 0); // QoS 0 is fine for high-throughput sensor data
            mqttClient.subscribe(locationTopic, 0);

            log.info("📡 Subscribed to {} and {}", carDataTopic, locationTopic);

        } catch (MqttException e) {
            log.error("❌ Failed to connect to MQTT broker", e);
        }
    }
}