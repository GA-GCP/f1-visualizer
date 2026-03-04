package com.elysianarts.f1.visualizer.user.service;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.firestore.repository.F1VUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.google.cloud.Timestamp;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class F1VUserServiceTest {

    @Mock
    private F1VUserRepository userRepository;

    @InjectMocks
    private F1VUserService f1VUserService;

    private final String testAuthId = "auth0|12345";
    private final String testEmail = "driver@f1visualizer.com";
    private F1VUserDocument existingUser;

    @BeforeEach
    void setUp() {
        existingUser = F1VUserDocument.builder()
                .authSubId(testAuthId)
                .email(testEmail)
                .createdAt(Timestamp.now())
                .preferences(new F1VUserDocument.UserPreferences())
                .build();
    }

    @Test
    void getOrCreateUser_ReturnsExistingUser_WhenFoundInFirestore() {
        when(userRepository.findById(testAuthId)).thenReturn(existingUser);
        F1VUserDocument result = f1VUserService.getOrCreateUser(testAuthId, testEmail);

        assertNotNull(result);
        assertEquals(testAuthId, result.getAuthSubId());
        verify(userRepository, never()).save(any(F1VUserDocument.class));
    }

    @Test
    void getOrCreateUser_CreatesNewUser_WhenNotFoundInFirestore() {
        when(userRepository.findById(testAuthId)).thenReturn(null);
        when(userRepository.save(any(F1VUserDocument.class))).thenAnswer(i -> i.getArguments()[0]);

        F1VUserDocument result = f1VUserService.getOrCreateUser(testAuthId, testEmail);

        assertNotNull(result);
        assertEquals(testAuthId, result.getAuthSubId());
        assertEquals(testEmail, result.getEmail());
        verify(userRepository, times(1)).save(any(F1VUserDocument.class));
    }

    @Test
    void updatePreferences_SuccessfullyUpdates_WhenUserExists() {
        F1VUserDocument.UserPreferences newPrefs = new F1VUserDocument.UserPreferences();
        newPrefs.setFavoriteDriver("Charles Leclerc");

        when(userRepository.findById(testAuthId)).thenReturn(existingUser);
        when(userRepository.save(any(F1VUserDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        F1VUserDocument result = f1VUserService.updatePreferences(testAuthId, newPrefs);

        assertEquals("Charles Leclerc", result.getPreferences().getFavoriteDriver());
        verify(userRepository, times(1)).save(existingUser);
    }

    @Test
    void updatePreferences_ThrowsException_WhenUserNotFound() {
        F1VUserDocument.UserPreferences newPrefs = new F1VUserDocument.UserPreferences();
        when(userRepository.findById(testAuthId)).thenReturn(null);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                f1VUserService.updatePreferences(testAuthId, newPrefs)
        );

        assertTrue(ex.getMessage().contains("User profile not found"));
    }

    @Test
    void getOrCreateUser_SetsCreatedAtTimestamp_WhenCreatingNewUser() {
        when(userRepository.findById(testAuthId)).thenReturn(null);
        when(userRepository.save(any(F1VUserDocument.class))).thenAnswer(i -> i.getArguments()[0]);

        F1VUserDocument result = f1VUserService.getOrCreateUser(testAuthId, testEmail);

        assertNotNull(result.getCreatedAt());
    }

    @Test
    void getOrCreateUser_InitializesEmptyPreferences_WhenCreatingNewUser() {
        when(userRepository.findById(testAuthId)).thenReturn(null);
        when(userRepository.save(any(F1VUserDocument.class))).thenAnswer(i -> i.getArguments()[0]);

        F1VUserDocument result = f1VUserService.getOrCreateUser(testAuthId, testEmail);

        assertNotNull(result.getPreferences());
    }
}
