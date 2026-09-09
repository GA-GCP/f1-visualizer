package com.elysianarts.f1.visualizer.user.exception;

import com.elysianarts.f1.visualizer.commons.web.error.ProblemDetailExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final ProblemDetailExceptionHandler sharedHandler = new ProblemDetailExceptionHandler();

    @Test
    void handleUserNotFound_Returns404ProblemDetail() {
        ProblemDetail problem = handler.handleUserNotFound(new UserNotFoundException("auth0|user_123"));

        assertEquals(HttpStatus.NOT_FOUND.value(), problem.getStatus());
        assertEquals("User Not Found", problem.getTitle());
        assertEquals("User profile not found for Auth ID: auth0|user_123", problem.getDetail());
    }

    @Test
    void handleUserNotFound_DetailContainsAuthId() {
        ProblemDetail problem = handler.handleUserNotFound(new UserNotFoundException("google-oauth2|456"));

        assertTrue(problem.getDetail().contains("google-oauth2|456"));
    }

    /** S5: a 5xx body must not echo the GCP client's message back to the browser. */
    @Test
    void handleUnexpected_Returns500_WithoutLeakingTheExceptionMessage() {
        ProblemDetail problem = sharedHandler.handleUnexpected(
                new RuntimeException("Firestore connection failed for project f1-visualizer-488201"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), problem.getStatus());
        assertFalse(problem.getDetail().contains("Firestore"));
        assertFalse(problem.getDetail().contains("f1-visualizer-488201"));
    }

    /** The body has to carry something support can find in the logs. */
    @Test
    void handleUnexpected_CarriesACorrelationIdMatchingTheLogLine() {
        ProblemDetail problem = sharedHandler.handleUnexpected(new RuntimeException("boom"));

        Object correlationId = problem.getProperties().get("correlationId");
        assertNotNull(correlationId);
        assertEquals(8, correlationId.toString().length());
    }
}
