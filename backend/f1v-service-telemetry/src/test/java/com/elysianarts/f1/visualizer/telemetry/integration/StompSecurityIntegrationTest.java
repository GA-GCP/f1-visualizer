package com.elysianarts.f1.visualizer.telemetry.integration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.lang.reflect.Type;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.messaging.converter.SimpleMessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * The STOMP gate, exercised end to end (T1).
 *
 * <p>Twenty-one of the suite's twenty-nine classes were Mockito units, and the seams that had
 * actually broken — the Redis wire format, STOMP authentication, BigQuery timestamp handling — were
 * exactly the ones no test drove against a real component. This one connects a real STOMP client to
 * a running broker over a real WebSocket, which is the only way to find out whether the interceptor
 * is on the inbound channel at all (S4).
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        // The broker is what is under test. There is no Redis here to subscribe
        // to or to health-check.
        properties = {
            "f1v.redis.subscriber.enabled=false",
            "management.health.redis.enabled=false",
            "logging.level.org.springframework.security.messaging=TRACE",
            "logging.level.org.springframework.web.socket.messaging=TRACE"
        })
@ActiveProfiles("test")
class StompSecurityIntegrationTest {

    @LocalServerPort private int port;

    /** The broker's gate is the decoder; nothing else about Redis is needed here. */
    @MockitoBean private JwtDecoder jwtDecoder;

    // Lettuce, not the plain interface: Boot's auto-configured factory is also a
    // ReactiveRedisConnectionFactory, and other beans ask for it by that type.
    @MockitoBean private LettuceConnectionFactory redisConnectionFactory;

    @Autowired private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    private WebSocketStompClient stompClient;

    @BeforeEach
    void setUp() {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        // SimpleMessageConverter, not StringMessageConverter: the latter only
        // accepts text/plain, and the broker labels these frames as JSON.
        stompClient.setMessageConverter(new SimpleMessageConverter());

        when(jwtDecoder.decode(eq("valid-token")))
                .thenReturn(
                        Jwt.withTokenValue("valid-token")
                                .header("alg", "none")
                                .subject("auth0|viewer")
                                .issuedAt(Instant.now())
                                .expiresAt(Instant.now().plusSeconds(300))
                                .claim("permissions", java.util.List.of())
                                .build());
        when(jwtDecoder.decode(eq("bad-token"))).thenThrow(new JwtException("expired"));
    }

    @AfterEach
    void tearDown() {
        stompClient.stop();
    }

    private String url() {
        return "ws://localhost:" + port + "/ws/websocket";
    }

    private StompSession connectWith(String token) throws Exception {
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return stompClient
                .connectAsync(
                        url(),
                        new org.springframework.web.socket.WebSocketHttpHeaders(),
                        headers,
                        new StompSessionHandlerAdapter() {
                            @Override
                            public void handleException(
                                    StompSession s,
                                    org.springframework.messaging.simp.stomp.StompCommand c,
                                    StompHeaders h,
                                    byte[] body,
                                    Throwable exception) {
                                System.out.println(
                                        "STOMP-DEBUG session exception: "
                                                + exception
                                                + " headers="
                                                + h);
                            }

                            @Override
                            public void handleTransportError(StompSession s, Throwable exception) {
                                System.out.println("STOMP-DEBUG transport error: " + exception);
                            }
                        })
                .get(10, TimeUnit.SECONDS);
    }

    /** S4: /ws/** is permitAll at the HTTP layer, so this interceptor is the only gate. */
    @Test
    void connect_IsRejected_WithoutAToken() {
        assertThrows(
                ExecutionException.class,
                () ->
                        stompClient
                                .connectAsync(url(), new StompSessionHandlerAdapter() {})
                                .get(10, TimeUnit.SECONDS));
    }

    @Test
    void connect_IsRejected_WithAnInvalidToken() {
        assertThrows(ExecutionException.class, () -> connectWith("bad-token"));
    }

    @Test
    void connect_Succeeds_WithAValidToken() throws Exception {
        StompSession session = connectWith("valid-token");

        assertTrue(session.isConnected());
        session.disconnect();
    }

    /**
     * The path a packet actually travels: broker to browser. What the Redis listener does with a
     * message is a unit test; that a subscriber receives it over a real socket is not.
     */
    @Test
    void aMessageOnTheTopicReachesASubscribedClient() throws Exception {
        StompSession session = connectWith("valid-token");

        CompletableFuture<String> received = new CompletableFuture<>();
        session.subscribe(
                "/topic/race-data",
                new StompSessionHandlerAdapter() {
                    @Override
                    public Type getPayloadType(StompHeaders headers) {
                        return byte[].class;
                    }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        received.complete(
                                new String(
                                        (byte[]) payload, java.nio.charset.StandardCharsets.UTF_8));
                    }

                    @Override
                    public void handleException(
                            StompSession s,
                            org.springframework.messaging.simp.stomp.StompCommand c,
                            StompHeaders h,
                            byte[] body,
                            Throwable exception) {
                        received.completeExceptionally(exception);
                    }
                });

        // The subscription is asynchronous; retry until the broker has registered it.
        String packet = "[{\"session_key\":9165,\"driver_number\":1,\"speed\":310,\"gear\":8}]";
        for (int i = 0; i < 40 && !received.isDone(); i++) {
            messagingTemplate.convertAndSend("/topic/race-data", (Object) packet);
            Thread.sleep(50);
        }

        assertEquals(packet, received.get(5, TimeUnit.SECONDS));
        session.disconnect();
    }

    /** SUBSCRIBE and SEND carried no authorization rules at all before S4. */
    @Test
    void unknownDestinationsAreDenied() throws Exception {
        StompSession session = connectWith("valid-token");

        CompletableFuture<Object> delivered = new CompletableFuture<>();
        session.subscribe(
                "/queue/somewhere-else",
                new StompSessionHandlerAdapter() {
                    @Override
                    public Type getPayloadType(StompHeaders headers) {
                        return byte[].class;
                    }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        delivered.complete(payload);
                    }
                });

        messagingTemplate.convertAndSend("/queue/somewhere-else", (Object) "should-not-arrive");

        assertThrows(
                java.util.concurrent.TimeoutException.class,
                () -> delivered.get(1, TimeUnit.SECONDS));
    }
}
