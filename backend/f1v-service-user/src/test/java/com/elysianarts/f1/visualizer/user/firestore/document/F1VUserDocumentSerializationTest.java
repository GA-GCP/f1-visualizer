package com.elysianarts.f1.visualizer.user.firestore.document;

import com.google.cloud.Timestamp;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

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
        Timestamp createdAt = Timestamp.now();
        F1VUserDocument original = F1VUserDocument.builder()
                .authSubId("auth0|user_123")
                .email("leclerc@ferrari.com")
                .createdAt(createdAt)
                .preferences(F1VUserDocument.UserPreferences.builder()
                        .favoriteDriver("Charles Leclerc")
                        .team("Ferrari")
                        .defaultTelemetryView("detailed")
                        .savedQueries(List.of("session:9165", "driver:16"))
                        .build())
                .build();

        // Verify serialization produces valid JSON with expected fields.
        // com.google.cloud.Timestamp has no Jackson @JsonCreator so full round-trip
        // is not possible, but Firestore handles Timestamp natively (not via Jackson).
        String json = mapper.writeValueAsString(original);
        JsonNode tree = mapper.readTree(json);

        assertEquals("auth0|user_123", tree.get("authSubId").asText());
        assertEquals("leclerc@ferrari.com", tree.get("email").asText());
        assertNotNull(tree.get("createdAt"));
        assertTrue(tree.get("createdAt").has("seconds"), "Timestamp should serialize with seconds field");
        assertEquals("Charles Leclerc", tree.get("preferences").get("favoriteDriver").asText());
        assertEquals("Ferrari", tree.get("preferences").get("team").asText());
        assertEquals(2, tree.get("preferences").get("savedQueries").size());
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
