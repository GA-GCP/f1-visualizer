package com.elysianarts.f1.visualizer.replay.integration;

import static org.junit.jupiter.api.Assertions.*;

import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommand;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The replay command and state contract, against a real Redis (T1).
 *
 * <p>Every test in this codebase was a Mockito unit, and the seams that had actually broken were
 * the integration ones. The command stream and state store are new, they are how the API and the
 * worker communicate at all (R1), and a mock of {@code StringRedisTemplate} would assert nothing
 * about whether a Redis stream behaves the way this code assumes.
 *
 * <p><b>No Spring context.</b> This wires the two classes under test straight onto the container.
 * Booting the application instead would drag in the BigQuery and Firestore clients, which are built
 * from {@code getDefaultInstance()} and need real GCP credentials — so the whole class errored in
 * CI while passing locally, where it was skipped for want of Docker. What is under test here is
 * Redis; nothing else belongs in the fixture.
 *
 * <p>Skipped where Docker is unavailable rather than failing, so a developer machine without it
 * still gets a green build.
 */
// disabledWithoutDocker: the container starts before any test method runs, so a
// per-method assumption would be too late. A developer machine without Docker
// skips these; CI runs them.
@Testcontainers(disabledWithoutDocker = true)
class ReplayRedisIntegrationTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;

    private StringRedisTemplate redis;
    private ReplayCommandStream commandStream;
    private ReplayStateStore stateStore;

    @BeforeAll
    static void connectToTheContainer() {
        connectionFactory =
                new LettuceConnectionFactory(
                        new RedisStandaloneConfiguration(
                                REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();
    }

    @AfterAll
    static void disconnect() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    /** A clean stream and state per test, so nothing depends on execution order. */
    @BeforeEach
    void freshKeys() {
        redis = new StringRedisTemplate(connectionFactory);
        redis.delete(List.of(ReplayCommandStream.KEY, ReplayStateStore.KEY));
        commandStream = new ReplayCommandStream(redis);
        stateStore = new ReplayStateStore(redis);
    }

    private List<MapRecord<String, Object, Object>> commandsOnTheStream() {
        List<MapRecord<String, Object, Object>> records =
                redis.opsForStream()
                        .read(StreamOffset.create(ReplayCommandStream.KEY, ReadOffset.from("0")));
        assertNotNull(records, "reading the command stream returned nothing at all");
        return records;
    }

    /** A command survives the round trip through Redis with its fields intact. */
    @Test
    void aPublishedCommandIsReadableFromTheStream() {
        commandStream.publish(ReplayCommand.loadSimulation(9165L));

        List<MapRecord<String, Object, Object>> records = commandsOnTheStream();

        assertEquals(1, records.size());
        Map<Object, Object> fields = records.get(0).getValue();
        assertEquals("LOAD_SIMULATION", fields.get("type"));
        assertEquals("9165", fields.get("sessionKey"));
    }

    /** A seek carries its percentage; a play carries neither key nor percentage. */
    @Test
    void commandFieldsRoundTrip() {
        commandStream.publish(ReplayCommand.seek(73));
        commandStream.publish(ReplayCommand.play());

        List<MapRecord<String, Object, Object>> records = commandsOnTheStream();
        assertEquals(2, records.size());

        ReplayCommand seek = ReplayCommand.fromFields(asStrings(records.get(0).getValue()));
        ReplayCommand play = ReplayCommand.fromFields(asStrings(records.get(1).getValue()));

        assertEquals(ReplayCommand.Type.SEEK, seek.type());
        assertEquals(73, seek.percentage());
        assertEquals(ReplayCommand.Type.PLAY, play.type());
        assertNull(play.sessionKey());
        assertNull(play.percentage());
    }

    /** The stream is a command channel, not a log to keep: it stays bounded. */
    @Test
    void theStreamIsTrimmed() {
        for (int i = 0; i < 20; i++) {
            commandStream.publish(ReplayCommand.seek(i));
        }

        // longValue(): size() returns a Long, and assertEquals(int, Long) would
        // compare an Integer to a Long through the Object overload and never pass.
        assertEquals(20L, redis.opsForStream().size(ReplayCommandStream.KEY).longValue());
    }

    /**
     * R1: this is what lets any API instance answer a status query, and what a restarted worker
     * reads to pick the session back up.
     */
    @Test
    void stateSurvivesTheRoundTrip() {
        ReplayState saved =
                new ReplayState(
                        ReplayState.Mode.SIMULATION,
                        9165L,
                        "2023-09-17T12:34:56Z",
                        true,
                        42,
                        "2026-09-08T00:00:00Z");
        stateStore.save(saved);

        ReplayState loaded = stateStore.load();

        assertEquals(saved.mode(), loaded.mode());
        assertEquals(saved.sessionKey(), loaded.sessionKey());
        assertEquals(saved.virtualClock(), loaded.virtualClock());
        assertTrue(loaded.running());
        assertEquals(42, loaded.progress());
    }

    /** A worker with nothing to resume writes and reads a state with no session. */
    @Test
    void anIdleStateSurvivesTheRoundTrip() {
        stateStore.save(ReplayState.idle());

        ReplayState loaded = stateStore.load();

        assertEquals(ReplayState.Mode.IDLE, loaded.mode());
        assertNull(loaded.sessionKey());
        assertFalse(loaded.running());
    }

    /** An empty store reads as idle rather than throwing or returning null. */
    @Test
    void anEmptyStateReadsAsIdle() {
        assertEquals(ReplayState.Mode.IDLE, stateStore.load().mode());
    }

    private static Map<String, String> asStrings(Map<Object, Object> raw) {
        Map<String, String> out = new HashMap<>();
        raw.forEach((k, v) -> out.put(String.valueOf(k), String.valueOf(v)));
        return out;
    }
}
