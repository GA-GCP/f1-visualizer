package com.elysianarts.f1.visualizer.commons.messaging.stomp;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * A required dependency, not an optional one (S4). Injected with {@code required = false}, a
     * resource server that failed to produce a decoder — a missing issuer property, a starter
     * change, a test profile — silently left the interceptor unregistered and the broker accepting
     * every CONNECT. There is no HTTP-layer gate behind it: {@code /ws/**} is {@code permitAll}.
     */
    private final JwtDecoder jwtDecoder;

    private final List<String> allowedOrigins;

    public WebSocketConfig(
            JwtDecoder jwtDecoder,
            @Value("${f1v.cors.allowed-origins}") List<String> allowedOrigins) {
        this.jwtDecoder = jwtDecoder;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins.toArray(String[]::new))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        ThreadPoolTaskScheduler heartbeatScheduler = new ThreadPoolTaskScheduler();
        heartbeatScheduler.setPoolSize(1);
        heartbeatScheduler.setThreadNamePrefix("ws-heartbeat-thread-");
        heartbeatScheduler.initialize();

        registry.enableSimpleBroker("/topic")
                .setTaskScheduler(heartbeatScheduler)
                .setHeartbeatValue(new long[] {10000, 10000});

        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new StompAuthChannelInterceptor(jwtDecoder));
    }
}
