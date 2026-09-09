package com.elysianarts.f1.visualizer.replay.config;

import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import com.elysianarts.f1.visualizer.replay.service.ReplayCommandListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;
import org.springframework.data.redis.stream.Subscription;

import java.time.Duration;
import java.util.UUID;

/**
 * Subscribes the worker to the command stream (R1).
 */
@Slf4j
@Configuration
public class ReplayStreamConfig {

    @Bean(destroyMethod = "stop")
    public StreamMessageListenerContainer<String, MapRecord<String, String, String>> replayCommandContainer(
            RedisConnectionFactory connectionFactory,
            StringRedisTemplate redis,
            ReplayCommandListener listener) {

        ensureConsumerGroup(redis);

        StreamMessageListenerContainer<String, MapRecord<String, String, String>> container =
                StreamMessageListenerContainer.create(connectionFactory,
                        StreamMessageListenerContainer.StreamMessageListenerContainerOptions.builder()
                                .pollTimeout(Duration.ofSeconds(1))
                                .build());

        Subscription subscription = container.receiveAutoAck(
                // One consumer per instance, and there is deliberately only ever one.
                Consumer.from(ReplayCommandStream.CONSUMER_GROUP, "worker-" + UUID.randomUUID()),
                StreamOffset.create(ReplayCommandStream.KEY, ReadOffset.lastConsumed()),
                listener);

        container.start();
        log.info("replay command listener started stream={} group={} active={}",
                ReplayCommandStream.KEY, ReplayCommandStream.CONSUMER_GROUP, subscription.isActive());
        return container;
    }

    /**
     * Creates the group, and the stream with it. Reading from a group that does
     * not exist is an error, and on a fresh environment nothing has published yet.
     */
    private void ensureConsumerGroup(StringRedisTemplate redis) {
        try {
            redis.opsForStream().createGroup(ReplayCommandStream.KEY, ReadOffset.from("0"),
                    ReplayCommandStream.CONSUMER_GROUP);
            log.info("replay consumer group created group={}", ReplayCommandStream.CONSUMER_GROUP);
        } catch (RuntimeException e) {
            // BUSYGROUP: it already exists, which is the normal case after the first start.
            log.debug("replay consumer group already present: {}", e.getMessage());
        }
    }
}
