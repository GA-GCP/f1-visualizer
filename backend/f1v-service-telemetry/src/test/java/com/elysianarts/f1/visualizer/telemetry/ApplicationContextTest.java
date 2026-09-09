package com.elysianarts.f1.visualizer.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * That every bean in this service can actually be constructed.
 *
 * <p>The subscriber is switched off and the connection factory mocked, because this container
 * connects to Redis while the context is still starting: a broker is an environment, not the wiring
 * this asserts.
 */
@SpringBootTest(
        properties = {
            "f1v.redis.subscriber.enabled=false",
            "management.health.redis.enabled=false"
        })
@ActiveProfiles("test")
class ApplicationContextTest {

    @Autowired private ApplicationContext context;

    @MockitoBean private LettuceConnectionFactory redisConnectionFactory;

    @Test
    void theContextStarts() {
        assertThat(context).isNotNull();
    }
}
