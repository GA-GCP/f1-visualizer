package com.elysianarts.f1.visualizer.user;

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
 * <p>Firestore is mocked: it is built from {@code getDefaultInstance()} and would need real
 * credentials, which is a property of the environment rather than of the wiring this asserts. The
 * settings it is built from are the ones Terraform passes in production.
 */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationContextTest {

    @Autowired private ApplicationContext context;

    @MockitoBean private Firestore firestore;

    @Test
    void theContextStarts() {
        assertThat(context).isNotNull();
    }

    /**
     * No BigQuery client, because this service does not query BigQuery.
     *
     * <p>Not housekeeping: this service declares no dataset, and when {@code commons-gcp} built the
     * BigQuery beans unconditionally the validation that makes a missing dataset fail loudly (C6)
     * stopped the service from starting on Cloud Run — {@code Property: f1v.bigquery.dataset,
     * Reason: must not be blank}.
     */
    @Test
    void noBigQueryClientIsBuilt() {
        assertThat(context.getBeanNamesForType(BigQuery.class)).isEmpty();
    }
}
