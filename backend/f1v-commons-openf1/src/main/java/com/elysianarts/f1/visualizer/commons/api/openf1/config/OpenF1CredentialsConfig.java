package com.elysianarts.f1.visualizer.commons.api.openf1.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenF1 sponsor-tier credentials.
 *
 * <p>These used to be read at version {@code latest} by a hand-rolled Secret
 * Manager client, which pulled the Secret Manager, protobuf and gRPC stack into
 * every ingestion image and hardcoded a project id as its default. Cloud Run
 * mounts the same two secrets as environment variables instead, so the
 * credential path is one platform feature rather than one client library and a
 * bean that fails at startup (S6).</p>
 */
@Configuration
public class OpenF1CredentialsConfig {

    public record OpenF1Credentials(String username, String password) {}

    @Bean
    public OpenF1Credentials openF1Credentials(
            @Value("${f1v.openf1.username:}") String username,
            @Value("${f1v.openf1.password:}") String password) {
        return new OpenF1Credentials(blankToNull(username), blankToNull(password));
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
