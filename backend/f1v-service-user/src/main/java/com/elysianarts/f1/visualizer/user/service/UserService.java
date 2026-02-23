package com.elysianarts.f1.visualizer.user.service;

import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.elysianarts.f1.visualizer.user.firestore.repository.F1UserRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Service
public class UserService {
    private final F1UserRepository userRepository;

    public UserService(F1UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public F1UserDocument getOrCreateUser(String oktaSubId, String email) {
        return userRepository.findById(oktaSubId)
                .switchIfEmpty(
                        Mono.defer(() -> userRepository.save(
                                F1UserDocument.builder()
                                        .oktaSubId(oktaSubId)
                                        .email(email)
                                        .createdAt(Instant.now())
                                        .preferences(new F1UserDocument.UserPreferences())
                                        .build()
                        ))
                )
                .block();
    }

    public F1UserDocument updatePreferences(String oktaSubId, F1UserDocument.UserPreferences newPreferences) {
        F1UserDocument existingUser = userRepository.findById(oktaSubId).block();

        if (existingUser != null) {
            existingUser.setPreferences(newPreferences);
            return userRepository.save(existingUser).block();
        }
        throw new RuntimeException("User profile not found for Okta ID: " + oktaSubId);
    }
}
