package com.elysianarts.f1.visualizer.telemetry.service;

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
        // 1. Extract the raw JSON telemetry packet from Redis
        // (We treat it as a String here for maximum throughput - zero-copy parsing if possible)
        String telemetryPayload = new String(message.getBody(), StandardCharsets.UTF_8);

        // 2. Broadcast immediately to all connected Frontend clients
        // Subscribers to "/topic/race-data" will receive this packet in real-time
        messagingTemplate.convertAndSend("/topic/race-data", telemetryPayload);
    }
}
