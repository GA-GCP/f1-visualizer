package com.elysianarts.f1.visualizer.replay;

import static org.assertj.core.api.Assertions.assertThat;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
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
 * <p>This exists because it was missing. Replacing WebClient with RestClient (C3) removed the
 * auto-configuration that supplies {@code RestClient.Builder} along with WebFlux, so {@code
 * OpenF1Client} could not be built and this service would not start — and nothing noticed, because
 * the unit tests construct the client from a {@code RestClient} directly and the slice tests mock
 * it. The first thing to run the real artifact found it.
 *
 * <p>The GCP clients are mocked: they are built from {@code getDefaultInstance()} and would need
 * real credentials, which is a property of the environment rather than of the wiring this asserts.
 */
@SpringBootTest(
        properties = {
            "f1v.redis.subscriber.enabled=false",
            "f1v.replay.command-listener.enabled=false",
            "management.health.redis.enabled=false"
        })
@ActiveProfiles("test")
class ApplicationContextTest {

    @Autowired private ApplicationContext context;

    @MockitoBean private com.google.cloud.bigquery.BigQuery bigQuery;

    @MockitoBean private LettuceConnectionFactory redisConnectionFactory;

    @Test
    void theContextStarts() {
        assertThat(context).isNotNull();
    }

    /** The two beans that could not be constructed, named so a regression says why. */
    @Test
    void theOpenF1ClientAndItsAuthServiceAreWired() {
        assertThat(context.getBean(OpenF1Client.class)).isNotNull();
        assertThat(context.getBean(OpenF1AuthService.class)).isNotNull();
    }
}
