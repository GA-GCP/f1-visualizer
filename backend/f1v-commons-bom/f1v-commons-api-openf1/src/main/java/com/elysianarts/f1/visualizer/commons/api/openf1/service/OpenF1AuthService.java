package com.elysianarts.f1.visualizer.commons.api.openf1.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.config.SecretManagerConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Slf4j
@Service
public class OpenF1AuthService {
    private final WebClient webClient;
    private final SecretManagerConfig.OpenF1Credentials credentials; // NEW: Hold our injected credentials
    private String currentAccessToken;

    public OpenF1AuthService(WebClient.Builder webClientBuilder, SecretManagerConfig.OpenF1Credentials credentials) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org").build();
        this.credentials = credentials;
    }

    // Run on startup, then every 50 minutes (3,000,000 ms)
    @PostConstruct
    @Scheduled(fixedRate = 3000000)
    public void refreshToken() {
        if (credentials == null || credentials.username() == null || credentials.password() == null) {
            log.warn("⚠️ OpenF1 credentials missing or mocked (Test Environment). Skipping authentication.");
            return;
        }
        log.info("🔐 Authenticating with OpenF1 API (Sponsorship Tier)...");

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        // NEW: Pull the username and password from the credentials record
        formData.add("username", credentials.username());
        formData.add("password", credentials.password());

        try {
            AuthResponse response = webClient.post()
                    .uri("/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .bodyToMono(AuthResponse.class)
                    .block();

            if (response != null && response.getAccessToken() != null) {
                this.currentAccessToken = response.getAccessToken();
                log.info("✅ OpenF1 authentication successful! Token cached.");
            } else {
                log.error("❌ OpenF1 authentication returned null token.");
            }
        } catch (Exception e) {
            log.error("❌ Failed to authenticate with OpenF1", e);
        }
    }

    public String getAccessToken() {
        return this.currentAccessToken;
    }

    @Data
    private static class AuthResponse {
        @JsonProperty("access_token")
        private String accessToken;
        @JsonProperty("token_type")
        private String tokenType;
        @JsonProperty("expires_in")
        private Integer expiresIn;
    }
}
