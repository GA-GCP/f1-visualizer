package com.elysianarts.f1.visualizer.telemetry.service;

import com.elysianarts.f1.visualizer.telemetry.config.RedisConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryListener implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        String channel = new String(message.getChannel(), StandardCharsets.UTF_8);

        if (RedisConfig.TELEMETRY_TOPIC.equals(channel)) {
            messagingTemplate.convertAndSend("/topic/race-data", payload);
        } else if (RedisConfig.LOCATION_TOPIC.equals(channel)) {
            messagingTemplate.convertAndSend("/topic/race-location", payload);
        } else if (RedisConfig.PLAYBACK_TOPIC.equals(channel)) {
            messagingTemplate.convertAndSend("/topic/playback-status", payload);
        }
    }
}