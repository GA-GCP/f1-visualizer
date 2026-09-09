package com.elysianarts.f1.visualizer.commons.api.openf1.client;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.*;
import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/**
 * C3: the client returns values rather than publishers, so these read as calls and results instead
 * of {@code StepVerifier} chains over a stack that was always blocked on immediately.
 */
class OpenF1ClientTest {

    private MockWebServer mockWebServer;
    private OpenF1Client openF1Client;

    private static final OffsetDateTime START =
            OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
    private static final OffsetDateTime END = START.plusSeconds(2);

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();

        OpenF1AuthService mockAuthService = mock(OpenF1AuthService.class);
        when(mockAuthService.requireAccessToken()).thenReturn("dummy-test-token");

        RestClient restClient =
                RestClient.builder().baseUrl(mockWebServer.url("/").toString()).build();
        // A near-zero backoff so the retry policy is exercised without waiting for it.
        openF1Client = new OpenF1Client(restClient, mockAuthService, Duration.ofMillis(1));
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    private void enqueueJson(String body) {
        mockWebServer.enqueue(
                new MockResponse().setBody(body).addHeader("Content-Type", "application/json"));
    }

    // ── Parsing ──

    @Test
    void getCarData_ParsesJsonCorrectly() {
        enqueueJson(
                """
            [
              {
                "session_key": 9165,
                "meeting_key": 1219,
                "date": "2023-09-17T12:00:00.123Z",
                "driver_number": 1,
                "speed": 310,
                "rpm": 11500,
                "n_gear": 8,
                "throttle": 100,
                "brake": 0,
                "drs": 1
              }
            ]
            """);

        List<OpenF1CarData> data = openF1Client.getCarData(9165, START, END);

        assertEquals(1, data.size());
        assertEquals(310, data.get(0).getSpeed());
        assertEquals(8, data.get(0).getGear(), "OpenF1 sends n_gear; the browser contract is gear");
        assertNotNull(data.get(0).getDate());
    }

    @Test
    void getCarData_SendsTheBearerTokenAndTheRangeQuery() throws Exception {
        enqueueJson("[]");

        openF1Client.getCarData(9165, START, END);

        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("Bearer dummy-test-token", request.getHeader("Authorization"));
        String path = request.getPath();
        assertTrue(path.contains("session_key=9165"), path);
        assertTrue(
                path.contains("date%3E="), "the >= range operator must survive encoding: " + path);
    }

    @Test
    void getLocationData_ParsesJsonCorrectly() {
        enqueueJson(
                """
            [{"session_key":9165,"date":"2023-09-17T12:00:00.456Z","driver_number":44,"x":1200,"y":3400,"z":100}]
            """);

        List<OpenF1LocationData> data = openF1Client.getLocationData(9165, START, END);

        assertEquals(1, data.size());
        assertEquals(44, data.get(0).getDriverNumber());
        assertEquals(1200, data.get(0).getX());
    }

    @Test
    void getLapData_ParsesJsonCorrectly() {
        enqueueJson(
                """
            [{"session_key":9165,"driver_number":1,"lap_number":5,"lap_duration":92.456}]
            """);

        List<OpenF1LapData> laps = openF1Client.getLapData(9165);

        assertEquals(1, laps.size());
        assertEquals(5, laps.get(0).getLapNumber());
        assertEquals(92.456, laps.get(0).getLapDuration());
    }

    @Test
    void getSession_ParsesSessionCorrectly() {
        enqueueJson(
                """
            [{"session_key":9165,"session_name":"Race","year":2023,"country_name":"Singapore",
              "date_start":"2023-09-17T12:00:00.000Z","date_end":"2023-09-17T14:00:00.000Z"}]
            """);

        Optional<OpenF1Session> session = openF1Client.getSession(9165);

        assertTrue(session.isPresent());
        assertEquals(9165L, session.get().getSessionKey());
        assertEquals("Race", session.get().getSessionName());
        assertNotNull(session.get().getDateEnd());
    }

    @Test
    void getSession_ReturnsEmpty_WhenApiReturnsEmptyArray() {
        enqueueJson("[]");

        assertTrue(openF1Client.getSession(9999).isEmpty());
    }

    /** C4: the reference loader reads these through the client now, not as Maps. */
    @Test
    void getDrivers_ParsesTheRoster() {
        enqueueJson(
                """
            [{"driver_number":1,"broadcast_name":"M VERSTAPPEN","name_acronym":"VER",
              "team_name":"Red Bull Racing","team_colour":"3671C6","country_code":"NED"}]
            """);

        List<OpenF1Driver> drivers = openF1Client.getDrivers("latest");

        assertEquals(1, drivers.size());
        assertEquals("VER", drivers.get(0).getNameAcronym());
        assertEquals("Red Bull Racing", drivers.get(0).getTeamName());
    }

    @Test
    void getMeetings_ParsesMeetingNames() {
        enqueueJson(
                """
            [{"meeting_key":1219,"meeting_name":"Singapore Grand Prix","year":2023}]
            """);

        List<OpenF1Meeting> meetings = openF1Client.getMeetings(2023);

        assertEquals("Singapore Grand Prix", meetings.get(0).getMeetingName());
    }

    // ── R5: failures are failures ──

    /**
     * A 500 used to be mapped to an empty stream, so the caller recorded "no telemetry for this
     * window" and moved on.
     */
    @Test
    void getCarData_RetriesThenFails_WhenApiReturns500() {
        // Four responses: the original attempt plus three retries.
        for (int i = 0; i < 4; i++) {
            mockWebServer.enqueue(
                    new MockResponse().setResponseCode(500).setBody("Internal Server Error"));
        }

        assertThrows(OpenF1Exception.class, () -> openF1Client.getCarData(9165, START, END));
        assertEquals(4, mockWebServer.getRequestCount());
    }

    /** A 401 is an answer, not a hiccup: retrying it only delays the failure. */
    @Test
    void getCarData_FailsImmediately_WhenApiReturns401() {
        mockWebServer.enqueue(new MockResponse().setResponseCode(401).setBody("Unauthorized"));

        assertThrows(OpenF1Exception.class, () -> openF1Client.getCarData(9165, START, END));
        assertEquals(1, mockWebServer.getRequestCount());
    }

    /** A transient failure that clears is invisible to the caller. */
    @Test
    void getCarData_Succeeds_WhenTheFirstAttemptIsTransient() {
        mockWebServer.enqueue(new MockResponse().setResponseCode(503));
        enqueueJson(
                """
            [{"session_key":9165,"driver_number":1,"speed":300,"n_gear":7}]
            """);

        List<OpenF1CarData> data = openF1Client.getCarData(9165, START, END);

        assertEquals(300, data.get(0).getSpeed());
        assertEquals(2, mockWebServer.getRequestCount());
    }

    @Test
    void getCarData_RetriesA429() {
        mockWebServer.enqueue(new MockResponse().setResponseCode(429));
        enqueueJson("[]");

        assertTrue(openF1Client.getCarData(9165, START, END).isEmpty());
        assertEquals(2, mockWebServer.getRequestCount());
    }
}
