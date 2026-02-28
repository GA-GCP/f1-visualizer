package com.elysianarts.f1.visualizer.user.firestore.repository;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
public class F1VUserRepository {
    private final Firestore firestore;
    private static final String COLLECTION_NAME = "users";

    public F1VUserDocument findById(String id) {
        try {
            DocumentSnapshot document = firestore.collection(COLLECTION_NAME).document(id).get().get();
            if (document.exists()) {
                return document.toObject(F1VUserDocument.class);
            }
            return null;
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to fetch user from Firestore", e);
        }
    }

    public F1VUserDocument save(F1VUserDocument user) {
        try {
            // Use the authSubId as the document Key
            firestore.collection(COLLECTION_NAME)
                    .document(user.getAuthSubId())
                    .set(user)
                    .get(); // block to ensure write completes
            return user;
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to save user to Firestore", e);
        }
    }
}