package com.elysianarts.f1.visualizer.telemetry.config;

import com.elysianarts.f1.visualizer.commons.messaging.redis.RedisTopics;
import com.elysianarts.f1.visualizer.telemetry.service.TelemetryListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * What is genuinely specific to this service: the subscription itself. The
 * template, serializer and topic names now come from commons (C1, C4).
 */
@Configuration
public class RedisSubscriberConfig {

    @Bean
    RedisMessageListenerContainer redisContainer(RedisConnectionFactory connectionFactory, TelemetryListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        container.addMessageListener(listener, new ChannelTopic(RedisTopics.TELEMETRY));
        container.addMessageListener(listener, new ChannelTopic(RedisTopics.LOCATION));
        container.addMessageListener(listener, new ChannelTopic(RedisTopics.PLAYBACK_STATUS));

        return container;
    }
}
