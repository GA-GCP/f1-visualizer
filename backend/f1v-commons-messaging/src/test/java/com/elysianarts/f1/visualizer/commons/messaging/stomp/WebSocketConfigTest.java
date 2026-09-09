package com.elysianarts.f1.visualizer.commons.messaging.stomp;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

class WebSocketConfigTest {

    /**
     * S4: the interceptor is the broker's only gate — {@code /ws/**} is {@code permitAll} at the
     * HTTP layer. It used to be registered only if a {@code JwtDecoder} happened to exist, so a
     * resource server that failed to produce one left every CONNECT accepted and nothing said so.
     */
    @Test
    void configureClientInboundChannel_RegistersTheJwtInterceptor() {
        WebSocketConfig config =
                new WebSocketConfig(mock(JwtDecoder.class), List.of("https://f1visualizer.com"));

        ChannelRegistration registration = new ChannelRegistration();
        config.configureClientInboundChannel(registration);

        @SuppressWarnings("unchecked")
        List<ChannelInterceptor> interceptors =
                (List<ChannelInterceptor>)
                        ReflectionTestUtils.invokeMethod(registration, "getInterceptors");

        assertTrue(
                interceptors != null
                        && interceptors.stream()
                                .anyMatch(StompAuthChannelInterceptor.class::isInstance),
                "StompAuthChannelInterceptor must be on the client inbound channel");
    }

    /** A decoder is a constructor argument now, so a context without one cannot start. */
    @Test
    void constructor_RequiresAJwtDecoder() {
        assertTrue(
                java.util.Arrays.stream(WebSocketConfig.class.getDeclaredConstructors())
                        .allMatch(
                                c ->
                                        java.util.Arrays.asList(c.getParameterTypes())
                                                .contains(JwtDecoder.class)),
                "every WebSocketConfig constructor must take a JwtDecoder");
    }
}
