package com.elysianarts.f1.visualizer.data.ingestion.config;

import com.elysianarts.f1.visualizer.commons.security.config.ServiceAuthorizationRules;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Who may drive ingestion (S1).
 *
 * <p>Until now the only rule in the codebase was {@code anyRequest().authenticated()}: anyone who
 * could sign up to the Auth0 tenant could delete and rewrite the {@code sessions}, {@code drivers}
 * and {@code session_drivers} tables, start minutes of billable OpenF1 ingestion, and switch the
 * global ingestion mode.
 *
 * <p><b>Auth0 setup this expects.</b> An API permission named {@code ingest:admin} with RBAC and
 * "Add Permissions in the Access Token" enabled, assigned to the roles that should hold it. Without
 * that, the token carries no {@code permissions} claim and these endpoints answer 403 for everyone
 * — which is the safe direction to fail.
 *
 * <p>Playback (play, pause, seek) is deliberately left open to any authenticated user: it is the
 * product. It is rate-limited instead, by {@link PlaybackRateLimitInterceptor}.
 */
@Configuration
public class IngestionSecurityConfig {

    public static final String INGEST_ADMIN = "ingest:admin";

    @Bean
    public ServiceAuthorizationRules ingestionAuthorizationRules() {
        return auth ->
                auth.requestMatchers(
                                "/api/v1/ingestion/load-reference",
                                "/api/v1/ingestion/load-historical",
                                "/api/v1/ingestion/command",
                                "/api/v1/ingestion/jobs/**")
                        .hasAuthority(INGEST_ADMIN);
    }
}
