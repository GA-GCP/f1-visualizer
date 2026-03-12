package com.elysianarts.f1.visualizer.telemetry.config;

import com.elysianarts.f1.visualizer.telemetry.service.TelemetryListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

/**
 * Redis pub/sub configuration for subscribing to live telemetry and location data,
 * then broadcasting to WebSocket clients via STOMP.
 *
 * <p><b>ObjectMapper Configuration:</b> The ObjectMapper disables
 * {@code MapperFeature.USE_ANNOTATIONS} and uses
 * {@link PropertyNamingStrategies#SNAKE_CASE}. This is intentional:</p>
 * <ul>
 *   <li>SNAKE_CASE converts Java field names (e.g. {@code sessionKey}) to snake_case
 *       JSON keys (e.g. {@code session_key}), matching the frontend TypeScript interfaces.</li>
 *   <li>Annotations are disabled because {@code @JsonProperty("n_gear")} on the DTO
 *       field {@code gear} (needed for OpenF1 API deserialization) would override the
 *       naming strategy and serialize as {@code "n_gear"} instead of {@code "gear"},
 *       breaking the frontend.</li>
 * </ul>
 *
 * <p>Wire format is validated by {@code OpenF1DtoSerializationTest}.</p>
 */
@Configuration
public class RedisConfig {
    public static final String TELEMETRY_TOPIC = "live_telemetry";
    public static final String LOCATION_TOPIC = "live_location";
    public static final String PLAYBACK_TOPIC = "playback_status";

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());

        // IMPORTANT: Annotations are disabled so the mapper uses ONLY the SNAKE_CASE
        // naming strategy on raw Java field names. See class-level Javadoc.
        ObjectMapper mapper = JsonMapper.builder()
                .disable(MapperFeature.USE_ANNOTATIONS)
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .build();
        JacksonJsonRedisSerializer<Object> valueSerializer = new JacksonJsonRedisSerializer<>(mapper, Object.class);

        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);

        return template;
    }

    @Bean
    RedisMessageListenerContainer redisContainer(RedisConnectionFactory connectionFactory, TelemetryListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        container.addMessageListener(listener, new ChannelTopic(TELEMETRY_TOPIC));
        container.addMessageListener(listener, new ChannelTopic(LOCATION_TOPIC));
        container.addMessageListener(listener, new ChannelTopic(PLAYBACK_TOPIC));

        return container;
    }
}