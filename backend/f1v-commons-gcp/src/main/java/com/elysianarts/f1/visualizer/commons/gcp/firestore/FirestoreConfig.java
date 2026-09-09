package com.elysianarts.f1.visualizer.commons.gcp.firestore;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The Firestore client, for the services that have one.
 *
 * <p>This module was one of the five commons modules that contained no code: the README placed the
 * Firestore configuration here while two byte-identical copies actually lived in the user and
 * analysis services (C1, C4). One copy, here, is what the module was for.
 *
 * <p>Consolidating it did mean every service that scans {@code commons} started building a
 * Firestore client, including the replay worker, which does not use Firestore and is given no
 * Firestore settings by Terraform. That worker could not start at all: the placeholder below had
 * nothing to resolve against. So the client is built where Firestore is configured and nowhere else
 * — a service that needs one and is missing its settings still fails immediately, on the injection
 * point that wanted it.
 */
@Configuration
@ConditionalOnProperty(name = "spring.cloud.gcp.firestore.project-id")
public class FirestoreConfig {

    @Value("${spring.cloud.gcp.firestore.project-id}")
    private String projectId;

    @Value("${spring.cloud.gcp.firestore.database-id}")
    private String databaseId;

    @Bean
    public Firestore firestore() {
        return FirestoreOptions.getDefaultInstance().toBuilder()
                .setProjectId(projectId)
                .setDatabaseId(databaseId)
                .build()
                .getService();
    }
}
