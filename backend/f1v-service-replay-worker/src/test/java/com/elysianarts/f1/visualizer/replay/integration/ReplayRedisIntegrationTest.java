package com.elysianarts.f1.visualizer.replay.integration;

import static org.junit.jupiter.api.Assertions.*;

import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommand;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayCommandStream;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayState;
import com.elysianarts.f1.visualizer.commons.messaging.replay.ReplayStateStore;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
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
 * <p>Skipped where Docker is unavailable rather than failing, so a developer machine without it
 * still gets a green build.
 */
// disabledWithoutDocker: the container starts before any test method runs, so a
// per-method assumption would be too late. A developer machine without Docker
// skips these; CI runs them.
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "spring.data.redis.ssl.enabled=false")
@ActiveProfiles("test")
class ReplayRedisIntegrationTest {

    @Container @ServiceConnection
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    @Autowired private ReplayCommandStream commandStream;

    @Autowired private ReplayStateStore stateStore;

    @Autowired private StringRedisTemplate redis;

    /** A command survives the round trip through Redis with its fields intact. */
    @Test
    void aPublishedCommandIsReadableFromTheStream() {

        commandStream.publish(ReplayCommand.loadSimulation(9165L));

        List<MapRecord<String, Object, Object>> records =
                redis.opsForStream().read(StreamOffset.fromStart(ReplayCommandStream.KEY));

        assertNotNull(records);
        assertFalse(records.isEmpty());
        var fields = records.get(records.size() - 1).getValue();
        assertEquals("LOAD_SIMULATION", fields.get("type"));
        assertEquals("9165", fields.get("sessionKey"));
    }

    /** A seek carries its percentage; a play carries neither key nor percentage. */
    @Test
    void commandFieldsRoundTrip() {

        commandStream.publish(ReplayCommand.seek(73));
        commandStream.publish(ReplayCommand.play());

        List<MapRecord<String, Object, Object>> records =
                redis.opsForStream()
                        .read(StreamOffset.create(ReplayCommandStream.KEY, ReadOffset.from("0")));

        assertNotNull(records);
        var seek = ReplayCommand.fromFields(asStrings(records.get(records.size() - 2).getValue()));
        var play = ReplayCommand.fromFields(asStrings(records.get(records.size() - 1).getValue()));

        assertEquals(ReplayCommand.Type.SEEK, seek.type());
        assertEquals(73, seek.percentage());
        assertEquals(ReplayCommand.Type.PLAY, play.type());
        assertNull(play.sessionKey());
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

    /** An empty store reads as idle rather than throwing or returning null. */
    @Test
    void anEmptyStateReadsAsIdle() {

        redis.delete(ReplayStateStore.KEY);

        assertEquals(ReplayState.Mode.IDLE, stateStore.load().mode());
    }

    private static java.util.Map<String, String> asStrings(java.util.Map<Object, Object> raw) {
        java.util.Map<String, String> out = new java.util.HashMap<>();
        raw.forEach((k, v) -> out.put(String.valueOf(k), String.valueOf(v)));
        return out;
    }
}
