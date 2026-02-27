package com.elysianarts.f1.visualizer.telemetry.controller.v1;

import com.elysianarts.f1.visualizer.telemetry.config.RedisConfig;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/debug")
public class TelemetryDebugController {
    private final RedisTemplate<String, Object> redisTemplate;

    public TelemetryDebugController(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // Call this endpoint to manually simulate an F1 car update!
    // POST /api/v1/debug/publish
    // Body: {"driver": "VER", "speed": 320, "gear": 8}
    @PostMapping("/publish")
    public ResponseEntity<String> publishManualTelemetry(@RequestBody Map<String, Object> payload) {
        // Publish to the same Redis topic our Listener is watching
        redisTemplate.convertAndSend(RedisConfig.TELEMETRY_TOPIC, payload);
        return ResponseEntity.ok("Published to Redis channel: " + RedisConfig.TELEMETRY_TOPIC);
    }
}
