package com.elysianarts.f1.visualizer.user.exception;

public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String authSubId) {
        super("User profile not found for Auth ID: " + authSubId);
    }
}
