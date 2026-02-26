package com.elysianarts.f1.visualizer.user.firestore.document;

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
// Removed @Document, @DocumentId (Native client doesn't use them)
public class F1UserDocument {

    // We will handle the ID manually in the Repository layer
    private String oktaSubId;

    private String email;
    // Note: Native client handles java.time.Instant conversion automatically
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
