package com.elysianarts.f1.visualizer.user.firestore.repository;

import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
public class F1UserRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "users";

    public F1UserDocument findById(String id) {
        try {
            DocumentSnapshot document = firestore.collection(COLLECTION_NAME).document(id).get().get();
            if (document.exists()) {
                return document.toObject(F1UserDocument.class);
            }
            return null;
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to fetch user from Firestore", e);
        }
    }

    public F1UserDocument save(F1UserDocument user) {
        try {
            // We use the oktaSubId as the document Key
            firestore.collection(COLLECTION_NAME)
                    .document(user.getOktaSubId())
                    .set(user)
                    .get(); // block to ensure write completes
            return user;
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to save user to Firestore", e);
        }
    }
}