package com.elysianarts.f1.visualizer.commons.gcp.firestore;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The Firestore client.
 *
 * <p>This module was one of the five commons modules that contained no code: the
 * README placed the Firestore configuration here while two byte-identical copies
 * actually lived in the user and analysis services (C1, C4). One copy, here, is
 * what the module was for.</p>
 */
@Configuration
public class FirestoreConfig {

    @Value("${spring.cloud.gcp.firestore.project-id}")
    private String projectId;

    @Value("${spring.cloud.gcp.firestore.database-id}")
    private String databaseId;

    @Bean
    public Firestore firestore() {
        return FirestoreOptions.getDefaultInstance()
                .toBuilder()
                .setProjectId(projectId)
                .setDatabaseId(databaseId)
                .build()
                .getService();
    }
}
