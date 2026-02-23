package com.elysianarts.f1.visualizer.user.firestore.document;

import com.google.cloud.firestore.annotation.DocumentId;
import com.google.cloud.spring.data.firestore.Document;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collectionName = "users")
public class F1UserDocument {
    @DocumentId
    private String oktaSubId;

    private String email;
    private Instant createdAt;
    private UserPreferences preferences;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserPreferences {
        private String favoriteDriver;
        private String team;
        private String defaultTelemetryView;
        private List<String> savedQueries;
    }
}
