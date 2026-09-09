package com.elysianarts.f1.visualizer.commons.web;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

/**
 * Structural guards on the API Gateway spec (C8, S3, S7).
 *
 * <p>The spec mirrors the controllers by hand and has to be edited on every route change, which is
 * how it came to carry about forty OPTIONS routes the load balancer had long since been answering,
 * and {@code disable_auth: true} on every backend — the setting that forced the public {@code
 * allUsers} invoker binding on all four services.
 *
 * <p>Generating it outright is not available: API Gateway accepts OpenAPI 2.0 and springdoc emits
 * 3.1. Each service now publishes its own contract at {@code /v3/api-docs}; what this asserts is
 * that the hand-written spec cannot silently reacquire the properties that caused those problems.
 */
@EnabledIf("specExists")
class GatewaySpecTest {

    private static final Path SPEC = Path.of("..", "..", "infrastructure", "openapi.yaml");

    /** Skips rather than fails when the module is built outside the repository. */
    static boolean specExists() {
        return Files.exists(SPEC);
    }

    private static String spec() throws IOException {
        return Files.readString(SPEC);
    }

    /** S3: `disable_auth: true` is what forced the allUsers invoker binding. */
    @Test
    void everyBackendAuthenticatesToItsCloudRunService() throws IOException {
        assertFalse(
                spec().contains("disable_auth: true"),
                "a backend with disable_auth: true requires the service to accept unauthenticated callers");
    }

    @Test
    void everyBackendDeclaresAJwtAudience() throws IOException {
        String spec = spec();
        long backends = countOccurrences(spec, "x-google-backend:");
        long audiences = countOccurrences(spec, "jwt_audience:");
        assertEquals(
                backends,
                audiences,
                "every x-google-backend needs a jwt_audience, or the gateway cannot mint a token for it");
    }

    /** S7: the load balancer answers preflight at the edge and never forwards it. */
    @Test
    void thereAreNoOptionsRoutes() throws IOException {
        assertFalse(
                Pattern.compile("^\\s{4}options:", Pattern.MULTILINE).matcher(spec()).find(),
                "OPTIONS routes are dead weight that still has to be kept in step with every route change");
    }

    /** Every operation is authenticated; the services are not reachable otherwise. */
    @Test
    void everyOperationCarriesASecurityRequirement() throws IOException {
        String spec = spec();
        assertEquals(
                countOccurrences(spec, "x-google-backend:"),
                countOccurrences(spec, "- auth0_jwt: ["),
                "every operation must state its security requirement");
    }

    /** S1: the administrative operations are the ones that rewrite BigQuery. */
    @Test
    void theAdministrativeOperationsRequireIngestAdmin() throws IOException {
        String spec = spec();
        List<String> adminPaths =
                List.of(
                        "/api/v1/ingestion/command",
                        "/api/v1/ingestion/load-historical",
                        "/api/v1/ingestion/load-reference",
                        "/api/v1/ingestion/jobs/{jobId}");

        for (String path : adminPaths) {
            String operation = operationFor(spec, path);
            assertTrue(
                    operation.contains("- auth0_jwt: [ingest:admin]"),
                    path + " must require the ingest:admin permission, but declares: " + operation);
        }
    }

    /** Playback is deliberately open to any signed-in user; it is the product. */
    @Test
    void playbackIsOpenToAnyAuthenticatedUser() throws IOException {
        String spec = spec();
        for (String path :
                List.of(
                        "/api/v1/ingestion/playback/play",
                        "/api/v1/ingestion/playback/pause",
                        "/api/v1/ingestion/playback/seek")) {
            assertTrue(
                    operationFor(spec, path).contains("- auth0_jwt: []"),
                    path + " should stay open to any authenticated user");
        }
    }

    private static String operationFor(String spec, String path) {
        int start = spec.indexOf("\n  " + path + ":");
        assertTrue(start >= 0, "route missing from the gateway spec: " + path);
        int next = spec.indexOf("\n  /api", start + 1);
        return spec.substring(start, next < 0 ? spec.length() : next);
    }

    private static long countOccurrences(String haystack, String needle) {
        List<Integer> found = new ArrayList<>();
        Matcher matcher = Pattern.compile(Pattern.quote(needle)).matcher(haystack);
        while (matcher.find()) {
            found.add(matcher.start());
        }
        return found.size();
    }
}
