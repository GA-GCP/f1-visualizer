package com.elysianarts.f1.visualizer.data.analysis.config;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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
