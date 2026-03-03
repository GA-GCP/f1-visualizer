package com.elysianarts.f1.visualizer.user.firestore.repository;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class F1VUserRepositoryTest {

    @Mock
    private Firestore firestore;

    @InjectMocks
    private F1VUserRepository f1VUserRepository;

    @SuppressWarnings("unchecked")
    @Test
    void findById_ReturnsUser_WhenDocumentExists() throws Exception {
        F1VUserDocument expectedUser = F1VUserDocument.builder()
                .authSubId("auth0|user_123")
                .email("leclerc@ferrari.com")
                .build();

        DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
        when(snapshot.exists()).thenReturn(true);
        when(snapshot.toObject(F1VUserDocument.class)).thenReturn(expectedUser);

        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);
        when(future.get()).thenReturn(snapshot);

        DocumentReference docRef = mock(DocumentReference.class);
        when(docRef.get()).thenReturn(future);

        CollectionReference collRef = mock(CollectionReference.class);
        when(collRef.document("auth0|user_123")).thenReturn(docRef);

        when(firestore.collection("users")).thenReturn(collRef);

        F1VUserDocument result = f1VUserRepository.findById("auth0|user_123");

        assertNotNull(result);
        assertEquals("auth0|user_123", result.getAuthSubId());
        assertEquals("leclerc@ferrari.com", result.getEmail());
    }

    @SuppressWarnings("unchecked")
    @Test
    void findById_ReturnsNull_WhenDocumentDoesNotExist() throws Exception {
        DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
        when(snapshot.exists()).thenReturn(false);

        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);
        when(future.get()).thenReturn(snapshot);

        DocumentReference docRef = mock(DocumentReference.class);
        when(docRef.get()).thenReturn(future);

        CollectionReference collRef = mock(CollectionReference.class);
        when(collRef.document("nonexistent")).thenReturn(docRef);

        when(firestore.collection("users")).thenReturn(collRef);

        F1VUserDocument result = f1VUserRepository.findById("nonexistent");

        assertNull(result);
    }

    @SuppressWarnings("unchecked")
    @Test
    void findById_ThrowsRuntimeException_WhenFirestoreFails() throws Exception {
        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);
        when(future.get()).thenThrow(new ExecutionException("Firestore unavailable", new RuntimeException()));

        DocumentReference docRef = mock(DocumentReference.class);
        when(docRef.get()).thenReturn(future);

        CollectionReference collRef = mock(CollectionReference.class);
        when(collRef.document("auth0|user_123")).thenReturn(docRef);

        when(firestore.collection("users")).thenReturn(collRef);

        assertThrows(RuntimeException.class, () ->
                f1VUserRepository.findById("auth0|user_123"));
    }
}
