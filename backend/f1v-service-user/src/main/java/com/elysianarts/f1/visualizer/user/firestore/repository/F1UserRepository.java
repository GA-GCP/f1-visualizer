package com.elysianarts.f1.visualizer.user.firestore.repository;

import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.google.cloud.spring.data.firestore.FirestoreReactiveRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface F1UserRepository extends FirestoreReactiveRepository<F1UserDocument> {
}
