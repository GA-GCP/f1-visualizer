package com.elysianarts.f1.visualizer.commons.web.error;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * The last-resort error shape for every service (S5).
 *
 * <p>Each service used to answer differently: the user service returned {@code "Internal server
 * error: " + ex.getMessage()}, which echoed GCP client messages, table names and project ids
 * straight to the browser; analysis had no advice at all and fell back to Boot's default error
 * JSON; ingestion returned free-text strings. A client could not handle the three uniformly and
 * support could not correlate any of them with a log line.
 *
 * <p>Every unhandled exception now becomes an RFC 9457 {@link ProblemDetail} with a fixed message
 * and a correlation id that appears in both the response body and the log entry carrying the stack
 * trace. Framework exceptions — validation, 404, unsupported media type — are left to Boot's own
 * problem-details advice, which runs ahead of this one; service-specific advices declare their own
 * order and take precedence over both.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class ProblemDetailExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailExceptionHandler.class);
    static final String CORRELATION_ID_PROPERTY = "correlationId";

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        String correlationId = UUID.randomUUID().toString().substring(0, 8);

        // The message stays in the log, where it is useful, and out of the body,
        // where it is a disclosure.
        log.error(
                "unhandled exception correlation_id={} type={}",
                correlationId,
                ex.getClass().getName(),
                ex);

        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "The request could not be completed. Quote the correlation id when reporting this.");
        problem.setTitle("Internal Server Error");
        problem.setProperty(CORRELATION_ID_PROPERTY, correlationId);
        return problem;
    }
}
