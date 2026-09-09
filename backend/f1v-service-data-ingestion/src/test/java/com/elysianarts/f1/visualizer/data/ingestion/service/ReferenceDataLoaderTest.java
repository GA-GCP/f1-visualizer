package com.elysianarts.f1.visualizer.data.ingestion.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Driver;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Meeting;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryProperties;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * C4: the loader used to build its own WebClient against the same API the typed client already
 * wraps, and read every response as an untyped Map — so this test had to drive a MockWebServer and
 * enqueue five responses in the right order.
 */
@ExtendWith(MockitoExtension.class)
class ReferenceDataLoaderTest {

    @Mock private OpenF1Client openF1Client;

    @Mock private BigQueryQueryRunner queryRunner;

    @Mock private BigQueryBatchWriter batchWriter;

    @InjectMocks private ReferenceDataLoader referenceDataLoader;

    @BeforeEach
    void stubDataset() {
        // C4: the dataset name is configuration now, not a constant per class.
        lenient().when(queryRunner.properties()).thenReturn(BigQueryProperties.defaults());
    }

    private static OpenF1Session session(long key) {
        OpenF1Session session = new OpenF1Session();
        session.setSessionKey(key);
        session.setMeetingKey(1219L);
        session.setSessionName("Race");
        session.setYear(2023);
        session.setCountryName("Singapore");
        session.setDateStart(OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC));
        session.setDateEnd(OffsetDateTime.of(2023, 9, 17, 14, 0, 0, 0, ZoneOffset.UTC));
        return session;
    }

    private static OpenF1Driver driver(int number) {
        OpenF1Driver driver = new OpenF1Driver();
        driver.setDriverNumber(number);
        driver.setBroadcastName("M VERSTAPPEN");
        driver.setNameAcronym("VER");
        driver.setTeamName("Red Bull Racing");
        driver.setTeamColour("3671C6");
        driver.setCountryCode("NED");
        return driver;
    }

    private static OpenF1Meeting meeting() {
        OpenF1Meeting meeting = new OpenF1Meeting();
        meeting.setMeetingKey(1219L);
        meeting.setMeetingName("Singapore Grand Prix");
        return meeting;
    }

    @Test
    void loadReferenceData_LoadsSessionsDriversAndRosters() {
        when(openF1Client.getMeetings(2023)).thenReturn(List.of(meeting()));
        when(openF1Client.getSessionsForYear(2023)).thenReturn(List.of(session(9165)));
        when(openF1Client.getDrivers("latest")).thenReturn(List.of(driver(1)));
        when(openF1Client.getDrivers("9165")).thenReturn(List.of(driver(1)));

        referenceDataLoader.loadReferenceData(2023);

        ArgumentCaptor<String> tableCaptor = ArgumentCaptor.captor();
        ArgumentCaptor<List<Map<String, Object>>> rowsCaptor = ArgumentCaptor.captor();
        verify(batchWriter, times(3))
                .append(eq("f1_dataset"), tableCaptor.capture(), rowsCaptor.capture());

        assertEquals(List.of("sessions", "drivers", "session_drivers"), tableCaptor.getAllValues());

        Map<String, Object> sessionRow = rowsCaptor.getAllValues().get(0).get(0);
        assertEquals(9165L, sessionRow.get("session_key"));
        // The meeting name comes from /meetings; /sessions does not carry it.
        assertEquals("Singapore Grand Prix", sessionRow.get("meeting_name"));
        // P2: the replay engine needs these to put a partition filter on telemetry.
        assertNotNull(sessionRow.get("date_start"));
        assertNotNull(sessionRow.get("date_end"));

        assertEquals(1, rowsCaptor.getAllValues().get(1).get(0).get("driver_number"));
        assertEquals(9165L, rowsCaptor.getAllValues().get(2).get(0).get("session_key"));
    }

    /** R4: a re-run replaces the year's rows rather than adding a second set. */
    @Test
    void loadReferenceData_ClearsExistingRowsFirst() throws Exception {
        when(openF1Client.getMeetings(2023)).thenReturn(List.of());
        when(openF1Client.getSessionsForYear(2023)).thenReturn(List.of(session(9165)));
        when(openF1Client.getDrivers("latest")).thenReturn(List.of(driver(1)));
        when(openF1Client.getDrivers("9165")).thenReturn(List.of(driver(1)));

        referenceDataLoader.loadReferenceData(2023);

        ArgumentCaptor<String> sql = ArgumentCaptor.captor();
        verify(queryRunner, times(3)).query(sql.capture());
        assertTrue(
                sql.getAllValues().stream().allMatch(q -> q.startsWith("DELETE FROM")),
                sql.getAllValues().toString());
    }

    /** One session's roster failing must not abandon the rest of the season. */
    @Test
    void loadReferenceData_ContinuesPastAFailedRoster() {
        when(openF1Client.getMeetings(2023)).thenReturn(List.of());
        when(openF1Client.getSessionsForYear(2023))
                .thenReturn(List.of(session(9165), session(9166)));
        when(openF1Client.getDrivers("latest")).thenReturn(List.of(driver(1)));
        when(openF1Client.getDrivers("9165"))
                .thenThrow(new IllegalStateException("OpenF1 is down"));
        when(openF1Client.getDrivers("9166")).thenReturn(List.of(driver(44)));

        referenceDataLoader.loadReferenceData(2023);

        // sessions, drivers, and the one roster that succeeded.
        verify(batchWriter, times(3)).append(eq("f1_dataset"), any(), any());
    }
}
