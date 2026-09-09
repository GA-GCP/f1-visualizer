package com.elysianarts.f1.visualizer.commons.api.openf1.client;

/**
 * An OpenF1 call that did not succeed (R5).
 *
 * <p>Every method on the client used to map every error to an empty stream, so a 401 from an
 * expired token read as "this session has no lap data" and an outage read as "nothing to ingest".
 * The caller could not tell the difference between no data and no answer, and neither could anyone
 * reading the logs.
 */
public class OpenF1Exception extends RuntimeException {

    public OpenF1Exception(String message, Throwable cause) {
        super(message, cause);
    }
}
