package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.fasterxml.jackson.annotation.JsonProperty;
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

import jakarta.annotation.PostConstruct;

@Slf4j
@Service
public class OpenF1AuthService {

    // Native integration pulls directly from GCP Secret Manager!
    @Value("${sm://f1v-api-openf1-login-user-email}")
    private String username;

    @Value("${sm://f1v-api-openf1-login-user-password}")
    private String password;

    private final WebClient webClient;
    private String currentAccessToken;

    public OpenF1AuthService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org").build();
    }

    // Run on startup, then every 50 minutes (3,000,000 ms)
    @PostConstruct
    @Scheduled(fixedRate = 3000000)
    public void refreshToken() {
        log.info("🔐 Authenticating with OpenF1 API (Sponsorship Tier)...");

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("username", username);
        formData.add("password", password);

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
