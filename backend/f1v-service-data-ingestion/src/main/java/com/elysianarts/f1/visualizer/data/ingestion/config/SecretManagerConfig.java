package com.elysianarts.f1.visualizer.data.ingestion.config;

import com.google.cloud.secretmanager.v1.AccessSecretVersionResponse;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretVersionName;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

@Configuration
public class SecretManagerConfig {
    @Value("${spring.cloud.gcp.project-id:f1-visualizer-488201}")
    private String projectId;

    public record OpenF1Credentials(String username, String password) {}

    @Bean
    public OpenF1Credentials openF1Credentials() {
        try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {

            String username = accessSecret(client, projectId, "f1v-api-openf1-login-user-email");
            String password = accessSecret(client, projectId, "f1v-api-openf1-login-user-password");

            return new OpenF1Credentials(username, password);

        } catch (IOException e) {
            throw new RuntimeException("Failed to initialize SecretManagerServiceClient", e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch OpenF1 secrets from GCP Secret Manager", e);
        }
    }

    private String accessSecret(SecretManagerServiceClient client, String projectId, String secretId) {
        // "latest" ensures we always grab the most recently added secret version
        SecretVersionName secretVersionName = SecretVersionName.of(projectId, secretId, "latest");
        AccessSecretVersionResponse response = client.accessSecretVersion(secretVersionName);
        return response.getPayload().getData().toStringUtf8();
    }
}
