package com.elysianarts.f1.visualizer.user.service;

import com.elysianarts.f1.visualizer.user.exception.UserNotFoundException;
import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.firestore.repository.F1VUserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class F1VUserService {
    private final F1VUserRepository userRepository;

    public F1VUserService(F1VUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public F1VUserDocument getOrCreateUser(String authSubId, String email) {
        F1VUserDocument existing = userRepository.findById(authSubId);
        if (existing != null) {
            return existing;
        }
        F1VUserDocument newUser = F1VUserDocument.builder()
                .authSubId(authSubId)
                .email(email)
                .createdAt(Instant.now())
                .preferences(new F1VUserDocument.UserPreferences())
                .build();
        return userRepository.save(newUser);
    }

    public F1VUserDocument updatePreferences(String authSubId, F1VUserDocument.UserPreferences newPreferences) {
        F1VUserDocument existingUser = userRepository.findById(authSubId);
        if (existingUser != null) {
            existingUser.setPreferences(newPreferences);
            return userRepository.save(existingUser);
        }
        throw new UserNotFoundException(authSubId);
    }
}