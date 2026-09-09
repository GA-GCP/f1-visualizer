package com.elysianarts.f1.visualizer.commons.gcp.bq;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Where the data lives and what a query is allowed to cost.
 *
 * <p>C4: {@code "f1_dataset"} was a private constant in ten classes across two services, while
 * {@code spring.cloud.gcp.bigquery.dataset-name} sat in every YAML file and was read by nothing.
 * C6: this is validated, so a missing or blank value fails at startup rather than at the first
 * query.
 */
/** Bound only where a dataset is configured; see {@link BigQueryConfig}. */
@ConditionalOnProperty(name = "f1v.bigquery.dataset")
@Validated
@ConfigurationProperties("f1v.bigquery")
public record BigQueryProperties(
        @NotBlank String dataset, @Positive long jobTimeoutMs, @Positive long maximumBytesBilled) {

    /** 30 s: comfortably above the windowed replay queries, well under the gateway's 120 s. */
    public static final long DEFAULT_JOB_TIMEOUT_MS = 30_000L;

    /** 50 GiB: roughly 100x a windowed chunk scan, and far below a full telemetry scan. */
    public static final long DEFAULT_MAXIMUM_BYTES_BILLED = 50L * 1024 * 1024 * 1024;

    public BigQueryProperties {
        if (jobTimeoutMs <= 0) jobTimeoutMs = DEFAULT_JOB_TIMEOUT_MS;
        if (maximumBytesBilled <= 0) maximumBytesBilled = DEFAULT_MAXIMUM_BYTES_BILLED;
    }

    /** Test and non-Spring construction with the documented defaults. */
    public static BigQueryProperties defaults() {
        return new BigQueryProperties(
                "f1_dataset", DEFAULT_JOB_TIMEOUT_MS, DEFAULT_MAXIMUM_BYTES_BILLED);
    }

    /** Fully-qualified table reference, for interpolation into SQL. */
    public String table(String table) {
        return dataset + "." + table;
    }
}
