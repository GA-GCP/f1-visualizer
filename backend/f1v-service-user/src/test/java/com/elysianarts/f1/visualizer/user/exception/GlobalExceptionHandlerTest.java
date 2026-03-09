package com.elysianarts.f1.visualizer.user.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @InjectMocks
    private GlobalExceptionHandler handler;

    @Test
    void handleUserNotFound_Returns404WithMessage() {
        UserNotFoundException ex = new UserNotFoundException("auth0|user_123");

        ResponseEntity<Map<String, Object>> response = handler.handleUserNotFound(ex);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals(404, response.getBody().get("status"));
        assertEquals("User profile not found for Auth ID: auth0|user_123", response.getBody().get("error"));
    }

    @Test
    void handleValidationErrors_Returns400WithFieldErrors() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
        bindingResult.addError(new FieldError("request", "email", "must not be blank"));
        bindingResult.addError(new FieldError("request", "name", "must not be null"));

        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, bindingResult);

        ResponseEntity<Map<String, Object>> response = handler.handleValidationErrors(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(400, response.getBody().get("status"));
        String errorMsg = (String) response.getBody().get("error");
        assertTrue(errorMsg.contains("email: must not be blank"));
        assertTrue(errorMsg.contains("name: must not be null"));
    }

    @Test
    void handleRuntimeException_Returns500WithMessage() {
        RuntimeException ex = new RuntimeException("Firestore connection failed");

        ResponseEntity<Map<String, Object>> response = handler.handleRuntimeException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(500, response.getBody().get("status"));
        assertEquals("Internal server error: Firestore connection failed", response.getBody().get("error"));
    }

    @Test
    void handleUserNotFound_MessageContainsAuthId() {
        UserNotFoundException ex = new UserNotFoundException("google-oauth2|456");

        ResponseEntity<Map<String, Object>> response = handler.handleUserNotFound(ex);

        String errorMsg = (String) response.getBody().get("error");
        assertTrue(errorMsg.contains("google-oauth2|456"));
    }
}
