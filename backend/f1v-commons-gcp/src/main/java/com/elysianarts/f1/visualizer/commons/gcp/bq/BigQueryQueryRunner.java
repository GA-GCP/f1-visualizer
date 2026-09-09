package com.elysianarts.f1.visualizer.commons.gcp.bq;

import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * Runs BigQuery queries with the two guardrails every query needs and none of them had (R6): a job
 * timeout, so a slow query cannot pin a request thread indefinitely, and a byte ceiling, so a query
 * that accidentally drops its partition filter fails rather than billing its way through the
 * largest table in the dataset.
 *
 * <p>Callers build the {@link QueryJobConfiguration.Builder} as before — including named parameters
 * — and hand it here instead of calling {@code BigQuery.query} directly.
 */
@Component
public class BigQueryQueryRunner {

    private final BigQuery bigQuery;
    private final BigQueryProperties properties;

    /**
     * O2: nothing measured BigQuery at all, so the full-table scan behind {@code
     * /drivers/{id}/stats} was invisible until someone read the bill.
     *
     * <p>This times and counts queries. Bytes scanned is deliberately not counted here: {@code
     * TableResult} does not carry it, and reading it would mean running every query as an explicit
     * job for a number GCP already publishes as {@code
     * bigquery.googleapis.com/query/scanned_bytes}. Alert on that; the {@code maximumBytesBilled}
     * ceiling below is the hard stop.
     */
    private final Timer queryTimer;

    public BigQueryQueryRunner(
            BigQuery bigQuery, BigQueryProperties properties, MeterRegistry meterRegistry) {
        this.bigQuery = bigQuery;
        this.properties = properties;
        this.queryTimer =
                Timer.builder("f1v.bigquery.query")
                        .description("BigQuery queries issued by this service")
                        .register(meterRegistry);
    }

    /** Test and non-Spring construction with the documented defaults. */
    public static BigQueryQueryRunner withDefaults(BigQuery bigQuery) {
        return new BigQueryQueryRunner(
                bigQuery, BigQueryProperties.defaults(), Metrics.globalRegistry);
    }

    /** The dataset and limits this runner was configured with. */
    public BigQueryProperties properties() {
        return properties;
    }

    public TableResult query(QueryJobConfiguration.Builder builder) throws InterruptedException {
        Timer.Sample sample = Timer.start();
        try {
            return bigQuery.query(guard(builder).build());
        } finally {
            sample.stop(queryTimer);
        }
    }

    public TableResult query(String sql) throws InterruptedException {
        return query(QueryJobConfiguration.newBuilder(sql));
    }

    private QueryJobConfiguration.Builder guard(QueryJobConfiguration.Builder builder) {
        return builder.setJobTimeoutMs(properties.jobTimeoutMs())
                .setMaximumBytesBilled(properties.maximumBytesBilled());
    }

    /** The underlying client, for the streaming-insert paths that are not queries. */
    public BigQuery client() {
        return bigQuery;
    }
}
