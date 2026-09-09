package com.elysianarts.f1.visualizer.user.firestore.document;

import com.google.cloud.Timestamp;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class F1VUserDocument {
    private String authSubId;

    private String email;
    private Timestamp createdAt;
    private UserPreferences preferences;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserPreferences {
        @Size(max = 50)
        private String favoriteDriver;

        @Size(max = 50)
        private String team;

        @Size(max = 50)
        private String defaultTelemetryView;

        @Size(max = 20)
        private List<String> savedQueries;
    }
}
