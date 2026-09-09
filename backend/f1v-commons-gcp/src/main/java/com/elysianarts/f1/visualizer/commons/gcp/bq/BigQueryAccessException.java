package com.elysianarts.f1.visualizer.commons.gcp.bq;

/**
 * A BigQuery read that did not succeed (R5).
 *
 * <p>The replay repositories used to return an empty list or {@code null} on any exception, which
 * the replay engine could only interpret as "this session is over". A BigQuery outage looked
 * exactly like a finished simulation.
 */
public class BigQueryAccessException extends RuntimeException {

    public BigQueryAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
