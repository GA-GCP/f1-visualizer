package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Driver;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Meeting;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Loads the reference catalog — sessions, the current grid, and per-race rosters.
 *
 * <p><b>C4: through the typed client.</b> This class used to build its own {@code WebClient}
 * against the same API the {@link OpenF1Client} already wraps, read every response as an untyped
 * {@code Map}, and carry a second constructor so tests could inject a client — three copies of the
 * base URL between them. It now uses the client every other loader uses.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQueryQueryRunner queryRunner;
    private final BigQueryBatchWriter batchWriter;

    public void loadReferenceData(int year) {
        log.info("reference load starting year={}", year);

        // The /sessions endpoint does not carry meeting_name; that lives on /meetings.
        Map<Long, String> meetingNames = buildMeetingNameLookup(year);

        List<OpenF1Session> sessions = openF1Client.getSessionsForYear(year);
        if (!sessions.isEmpty()) {
            deleteExistingData("sessions", "year = " + year);

            List<Map<String, Object>> rows = new ArrayList<>();
            for (OpenF1Session session : sessions) {
                Map<String, Object> row = new HashMap<>();
                row.put("session_key", session.getSessionKey());
                row.put("session_name", session.getSessionName());
                row.put("meeting_key", session.getMeetingKey());
                row.put("meeting_name", meetingNames.get(session.getMeetingKey()));
                row.put("year", session.getYear());
                row.put("country_name", session.getCountryName());
                // P2: the replay engine needs a date window to put a partition
                // filter on the telemetry table.
                row.put(
                        "date_start",
                        session.getDateStart() == null ? null : session.getDateStart().toString());
                row.put(
                        "date_end",
                        session.getDateEnd() == null ? null : session.getDateEnd().toString());
                rows.add(row);
            }
            flushToBigQuery("sessions", rows);
        } else {
            log.warn("reference load found no sessions year={}", year);
        }

        loadCurrentGrid();
        loadSessionDrivers(year, sessions);

        log.info("reference load complete year={} sessions={}", year, sessions.size());
    }

    /** The current grid, used for the master driver list. */
    private void loadCurrentGrid() {
        List<OpenF1Driver> drivers = openF1Client.getDrivers("latest");
        if (drivers.isEmpty()) {
            log.warn(
                    "reference drivers fetch returned nothing — leaving the existing grid in place");
            return;
        }

        deleteExistingData("drivers", "1=1");

        List<Map<String, Object>> rows = new ArrayList<>();
        for (OpenF1Driver driver : drivers) {
            rows.add(driverRow(driver, null, null));
        }
        flushToBigQuery("drivers", rows);
    }

    /**
     * The roster for every session in the year, which captures who drove for which team at each
     * specific race.
     */
    private void loadSessionDrivers(int year, List<OpenF1Session> sessions) {
        if (sessions.isEmpty()) {
            log.warn("session roster load skipped year={} reason=no_sessions", year);
            return;
        }

        deleteExistingData("session_drivers", "year = " + year);

        int totalDriverRows = 0;
        for (OpenF1Session session : sessions) {
            Long sessionKey = session.getSessionKey();
            if (sessionKey == null) continue;

            try {
                List<OpenF1Driver> drivers = openF1Client.getDrivers(String.valueOf(sessionKey));
                if (drivers.isEmpty()) continue;

                List<Map<String, Object>> rows = new ArrayList<>();
                for (OpenF1Driver driver : drivers) {
                    rows.add(driverRow(driver, sessionKey, year));
                }
                flushToBigQuery("session_drivers", rows);
                totalDriverRows += rows.size();
            } catch (RuntimeException e) {
                // One session's roster failing should not abandon the season.
                log.warn("session roster fetch failed session_key={}", sessionKey, e);
            }
        }

        log.info(
                "session roster load complete year={} rows={} sessions={}",
                year,
                totalDriverRows,
                sessions.size());
    }

    private Map<String, Object> driverRow(OpenF1Driver driver, Long sessionKey, Integer year) {
        Map<String, Object> row = new HashMap<>();
        if (sessionKey != null) row.put("session_key", sessionKey);
        if (year != null) row.put("year", year);
        row.put("driver_number", driver.getDriverNumber());
        row.put("broadcast_name", driver.getBroadcastName());
        row.put("name_acronym", driver.getNameAcronym());
        row.put("team_name", driver.getTeamName());
        row.put("team_colour", driver.getTeamColour());
        row.put("country_code", driver.getCountryCode());
        return row;
    }

    private Map<Long, String> buildMeetingNameLookup(int year) {
        Map<Long, String> lookup = new HashMap<>();
        try {
            for (OpenF1Meeting meeting : openF1Client.getMeetings(year)) {
                if (meeting.getMeetingKey() != null && meeting.getMeetingName() != null) {
                    lookup.put(meeting.getMeetingKey(), meeting.getMeetingName());
                }
            }
            log.info("meeting name lookup built year={} entries={}", year, lookup.size());
        } catch (RuntimeException e) {
            log.warn(
                    "meeting fetch failed year={} — sessions will load without meeting names",
                    year,
                    e);
        }
        return lookup;
    }

    private void deleteExistingData(String table, String whereClause) {
        String sql = String.format("DELETE FROM `%s.%s` WHERE %s", dataset(), table, whereClause);
        try {
            queryRunner.query(sql);
            log.info("reference rows cleared table={} where={}", table, whereClause);
        } catch (Exception e) {
            throw new IllegalStateException("Could not clear existing rows in " + table, e);
        }
    }

    /**
     * R4: a batch load rather than a streaming insert. The delete-then-insert above could leave
     * stale rows behind precisely because streamed rows sit in a buffer that DML cannot remove for
     * up to about 90 minutes.
     */
    private void flushToBigQuery(String table, List<Map<String, Object>> rows) {
        batchWriter.append(dataset(), table, rows);
        log.info("reference load complete table={} rows={}", table, rows.size());
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
