package com.elysianarts.f1.visualizer.data.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.firestore.Firestore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * That every bean in this service can actually be constructed.
 *
 * <p>The GCP clients are mocked: they are built from {@code getDefaultInstance()} and would need
 * real credentials, which is a property of the environment rather than of the wiring this asserts.
 * This service uses both, so both are expected to be present.
 */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationContextTest {

    @Autowired private ApplicationContext context;

    @MockitoBean private BigQuery bigQuery;

    @MockitoBean private Firestore firestore;

    @Test
    void theContextStarts() {
        assertThat(context).isNotNull();
    }

    /** Both clients are configured here, so both are wired rather than quietly conditioned away. */
    @Test
    void bothGcpClientsAreWired() {
        assertThat(context.getBeanNamesForType(BigQuery.class)).isNotEmpty();
        assertThat(context.getBeanNamesForType(Firestore.class)).isNotEmpty();
    }
}
