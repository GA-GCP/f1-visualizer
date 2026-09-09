package com.elysianarts.f1.visualizer.commons.messaging.stomp;

import com.elysianarts.f1.visualizer.commons.security.config.AuthoritiesConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    private final JwtDecoder jwtDecoder;
    private final AuthoritiesConverter authoritiesConverter = new AuthoritiesConverter();

    public StompAuthChannelInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("stomp connect rejected reason=missing_or_malformed_authorization_header");
                // An authorization failure, not a malformed argument: this is what
                // Spring's messaging layer turns into an ERROR frame rather than a
                // generic 500 (S4).
                throw new AccessDeniedException("Missing or invalid Authorization header");
            }

            String token = authHeader.substring(7);
            try {
                Jwt jwt = jwtDecoder.decode(token);
                // With authorities, not without. The single-argument constructor
                // leaves the token with authenticated=false, which CONNECT never
                // noticed — nothing checked it — but which denies every SUBSCRIBE
                // once there are message authorization rules to check it against
                // (S4). Same converter as the HTTP side, so an Auth0 permission
                // means the same thing on both (S1).
                accessor.setUser(
                        new JwtAuthenticationToken(jwt, authoritiesConverter.convert(jwt)));
                log.debug("stomp connect authenticated subject={}", jwt.getSubject());
            } catch (JwtException e) {
                log.warn("stomp connect rejected reason=invalid_jwt detail={}", e.getMessage());
                throw new AccessDeniedException("Invalid JWT token");
            }
        }

        return message;
    }
}
