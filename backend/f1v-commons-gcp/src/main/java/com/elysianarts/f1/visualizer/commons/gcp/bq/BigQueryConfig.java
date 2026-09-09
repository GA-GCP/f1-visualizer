package com.elysianarts.f1.visualizer.commons.gcp.bq;

import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.BigQueryOptions;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Whether this service talks to BigQuery at all.
 *
 * <p>Every service scans {@code commons}, so consolidating the GCP clients here (C1) handed all of
 * them to services that use neither. The user service does not touch BigQuery and declares no
 * dataset, and the validation that makes a missing dataset fail loudly (C6) then stopped it from
 * starting. So the BigQuery beans are built where a dataset is configured — which the three
 * services that query it all declare, with a default, in their own YAML.
 */
@ConditionalOnProperty(name = "f1v.bigquery.dataset")
@Configuration
public class BigQueryConfig {
    @Bean
    public BigQuery bigQuery() {
        return BigQueryOptions.getDefaultInstance().getService();
    }
}
