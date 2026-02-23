package com.elysianarts.f1.visualizer.telemetry.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // The "Handshake" endpoint the React App will connect to
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:5173", "https://f1visualizer.com") // Strict CORS for Dev & Prod
                .withSockJS(); // Enable SockJS fallback options
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable a simple in-memory broker to push messages to clients
        // The frontend will subscribe to paths starting with "/topic"
        registry.enableSimpleBroker("/topic");

        // Prefix for messages bound for @MessageMapping methods (Client -> Server)
        registry.setApplicationDestinationPrefixes("/app");
    }
}
