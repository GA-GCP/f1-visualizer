package com.elysianarts.f1.visualizer.commons.websocket.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StompAuthChannelInterceptorTest {

    @Mock
    private JwtDecoder jwtDecoder;

    private StompAuthChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new StompAuthChannelInterceptor(jwtDecoder);
    }

    private Message<byte[]> buildStompMessage(StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    void preSend_SetsUserPrincipal_WhenValidJwtOnConnect() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Bearer valid-token");

        Jwt mockJwt = new Jwt("valid-token", Instant.now(), Instant.now().plusSeconds(3600),
                Map.of("alg", "RS256"), Map.of("sub", "auth0|user123"));

        when(jwtDecoder.decode("valid-token")).thenReturn(mockJwt);

        Message<byte[]> message = buildStompMessage(accessor);
        Message<?> result = interceptor.preSend(message, null);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertNotNull(resultAccessor.getUser());
        assertInstanceOf(JwtAuthenticationToken.class, resultAccessor.getUser());
    }

    @Test
    void preSend_ThrowsException_WhenAuthHeaderMissing() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);

        Message<byte[]> message = buildStompMessage(accessor);

        assertThrows(IllegalArgumentException.class, () ->
                interceptor.preSend(message, null));
    }

    @Test
    void preSend_ThrowsException_WhenBearerPrefixMissing() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Basic some-credentials");

        Message<byte[]> message = buildStompMessage(accessor);

        assertThrows(IllegalArgumentException.class, () ->
                interceptor.preSend(message, null));
    }

    @Test
    void preSend_ThrowsException_WhenJwtIsInvalid() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Bearer invalid-token");

        when(jwtDecoder.decode("invalid-token")).thenThrow(new JwtException("Token expired"));

        Message<byte[]> message = buildStompMessage(accessor);

        assertThrows(IllegalArgumentException.class, () ->
                interceptor.preSend(message, null));
    }

    @Test
    void preSend_PassesThrough_WhenCommandIsNotConnect() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);

        Message<byte[]> message = buildStompMessage(accessor);
        Message<?> result = interceptor.preSend(message, null);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertNull(resultAccessor.getUser());
    }
}
