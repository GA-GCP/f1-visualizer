package com.elysianarts.f1.visualizer.commons.messaging.stomp;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;

/**
 * Authorization rules for STOMP messages (S4).
 *
 * <p>Before this, {@link StompAuthChannelInterceptor} inspected CONNECT and nothing inspected
 * anything else: a client that got a CONNECT through could SUBSCRIBE or SEND anywhere the broker
 * would route. CONNECT stays open at this layer because the JWT interceptor is what gates it;
 * everything with a destination must be authenticated, and anything not named here is denied.
 */
@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {

    @Bean
    public AuthorizationManager<Message<?>> messageAuthorizationManager(
            MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages
                // CONNECT carries the bearer token and is gated by StompAuthChannelInterceptor;
                // the lifecycle frames below carry no destination to authorize.
                .simpTypeMatchers(
                        SimpMessageType.CONNECT,
                        SimpMessageType.DISCONNECT,
                        SimpMessageType.UNSUBSCRIBE,
                        SimpMessageType.HEARTBEAT)
                .permitAll()
                .simpDestMatchers("/topic/**")
                .authenticated()
                .anyMessage()
                .denyAll();
        return messages.build();
    }

    /**
     * The STOMP CSRF interceptor that {@code @EnableWebSocketSecurity} installs by default protects
     * cookie-authenticated sessions. This broker authenticates each CONNECT from a bearer token in
     * a native STOMP header and holds no session cookie, so there is no ambient credential for a
     * cross-origin page to ride — and the SockJS client sends no CSRF token, so leaving it on would
     * simply reject every connection.
     */
    @Bean(name = "csrfChannelInterceptor")
    public ChannelInterceptor csrfChannelInterceptor() {
        return new ChannelInterceptor() {};
    }
}
