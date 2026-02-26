package com.elysianarts.f1.visualizer.user.service;

import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.elysianarts.f1.visualizer.user.firestore.repository.F1UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private F1UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private final String testOktaId = "okta_12345";
    private final String testEmail = "driver@f1visualizer.com";
    private F1UserDocument existingUser;

    @BeforeEach
    void setUp() {
        existingUser = F1UserDocument.builder()
                .oktaSubId(testOktaId)
                .email(testEmail)
                .createdAt(Instant.now())
                .preferences(new F1UserDocument.UserPreferences())
                .build();
    }

    @Test
    void getOrCreateUser_ReturnsExistingUser_WhenFoundInFirestore() {
        // Arrange: Simulate finding the user (Direct object, no Mono)
        when(userRepository.findById(testOktaId)).thenReturn(existingUser);

        // Act
        F1UserDocument result = userService.getOrCreateUser(testOktaId, testEmail);

        // Assert
        assertNotNull(result);
        assertEquals(testOktaId, result.getOktaSubId());
        // Verify we didn't try to save a new one
        verify(userRepository, never()).save(any(F1UserDocument.class));
    }

    @Test
    void getOrCreateUser_CreatesNewUser_WhenNotFoundInFirestore() {
        // Arrange: Return null to simulate "not found" in the synchronous repo
        when(userRepository.findById(testOktaId)).thenReturn(null);

        // Mock the save to return the object passed to it
        when(userRepository.save(any(F1UserDocument.class))).thenAnswer(i -> i.getArguments()[0]);

        // Act
        F1UserDocument result = userService.getOrCreateUser(testOktaId, testEmail);

        // Assert
        assertNotNull(result);
        assertEquals(testOktaId, result.getOktaSubId());
        assertEquals(testEmail, result.getEmail());

        // Verify save was called once
        verify(userRepository, times(1)).save(any(F1UserDocument.class));
    }

    @Test
    void updatePreferences_SuccessfullyUpdates_WhenUserExists() {
        // Arrange
        F1UserDocument.UserPreferences newPrefs = new F1UserDocument.UserPreferences();
        newPrefs.setFavoriteDriver("Charles Leclerc");

        when(userRepository.findById(testOktaId)).thenReturn(existingUser);
        when(userRepository.save(any(F1UserDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        F1UserDocument result = userService.updatePreferences(testOktaId, newPrefs);

        // Assert
        assertEquals("Charles Leclerc", result.getPreferences().getFavoriteDriver());
        verify(userRepository, times(1)).save(existingUser);
    }

    @Test
    void updatePreferences_ThrowsException_WhenUserNotFound() {
        // Arrange
        F1UserDocument.UserPreferences newPrefs = new F1UserDocument.UserPreferences();
        when(userRepository.findById(testOktaId)).thenReturn(null);

        // Act & Assert
        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                userService.updatePreferences(testOktaId, newPrefs)
        );

        assertTrue(ex.getMessage().contains("User profile not found"));
    }
}