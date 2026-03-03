package com.elysianarts.f1.visualizer.user.firestore.document;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class F1VUserDocumentSerializationTest {

    private JsonMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = JsonMapper.builder().findAndAddModules().build();
    }

    @Test
    void userDocument_RoundTrips_Correctly() throws Exception {
        F1VUserDocument original = F1VUserDocument.builder()
                .authSubId("auth0|user_123")
                .email("leclerc@ferrari.com")
                .createdAt(Instant.parse("2023-09-17T12:00:00Z"))
                .preferences(F1VUserDocument.UserPreferences.builder()
                        .favoriteDriver("Charles Leclerc")
                        .team("Ferrari")
                        .defaultTelemetryView("detailed")
                        .savedQueries(List.of("session:9165", "driver:16"))
                        .build())
                .build();

        String json = mapper.writeValueAsString(original);
        F1VUserDocument deserialized = mapper.readValue(json, F1VUserDocument.class);

        assertEquals(original.getAuthSubId(), deserialized.getAuthSubId());
        assertEquals(original.getEmail(), deserialized.getEmail());
        assertEquals(original.getCreatedAt(), deserialized.getCreatedAt());
        assertEquals(original.getPreferences().getFavoriteDriver(), deserialized.getPreferences().getFavoriteDriver());
        assertEquals(original.getPreferences().getTeam(), deserialized.getPreferences().getTeam());
        assertEquals(2, deserialized.getPreferences().getSavedQueries().size());
    }

    @Test
    void userDocument_HandlesNullPreferences_WithoutError() throws Exception {
        F1VUserDocument original = F1VUserDocument.builder()
                .authSubId("auth0|user_456")
                .email("test@test.com")
                .build();

        String json = mapper.writeValueAsString(original);
        F1VUserDocument deserialized = mapper.readValue(json, F1VUserDocument.class);

        assertEquals("auth0|user_456", deserialized.getAuthSubId());
        assertNull(deserialized.getPreferences());
    }
}
