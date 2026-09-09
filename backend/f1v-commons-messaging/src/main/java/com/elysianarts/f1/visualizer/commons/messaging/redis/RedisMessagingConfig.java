package com.elysianarts.f1.visualizer.commons.messaging.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

/**
 * Redis pub/sub, shared by the publisher and the subscriber.
 *
 * <p>C1, C4: this configuration was duplicated, near-identically, in the
 * ingestion and telemetry services — including the topic names that are the
 * contract between them. The README placed it in commons; it was not there.</p>
 *
 * <p><b>Wire format.</b> {@link #redisObjectMapper()} produces the JSON the
 * browser consumes, so it is the contract in code form and is exercised directly
 * by {@code RedisWireFormatTest}. It used to disable
 * {@code MapperFeature.USE_ANNOTATIONS} entirely — to stop one field's
 * {@code @JsonProperty("n_gear")} overriding the naming strategy — which left
 * every other annotation on every DTO silently inert. That field carries
 * {@code @JsonProperty("gear") @JsonAlias("n_gear")} now, so annotations stay on
 * and the naming strategy is a safety net rather than the only thing holding the
 * format together (C5).</p>
 */
@Configuration
public class RedisMessagingConfig {

    /**
     * The browser wire format. Static so the contract test can assert against the
     * real mapper rather than a copy of its configuration.
     */
    public static ObjectMapper redisObjectMapper() {
        return JsonMapper.builder()
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .findAndAddModules()
                .build();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());

        JacksonJsonRedisSerializer<Object> valueSerializer =
                new JacksonJsonRedisSerializer<>(redisObjectMapper(), Object.class);

        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);

        return template;
    }
}
