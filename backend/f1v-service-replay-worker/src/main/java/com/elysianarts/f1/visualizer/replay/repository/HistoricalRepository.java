package com.elysianarts.f1.visualizer.replay.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryAccessException;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.replay.model.SessionBounds;
import com.google.cloud.bigquery.*;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
@RequiredArgsConstructor
public class HistoricalRepository {

    private final BigQueryQueryRunner queryRunner;
    private static final String TABLE = "telemetry";

    /**
     * Fetches the MIN/MAX date bounds for a session's telemetry data. Returns null if the session
     * has no data.
     *
     * <p>Two cheap queries rather than one expensive one (P2). The telemetry table now requires a
     * partition filter, and this query had none — it was a MIN/MAX across every partition. The
     * session's advertised window comes from the small unpartitioned {@code sessions} table first,
     * and bounds the exact MIN/MAX that follows.
     */
    public SessionBounds fetchTelemetryBounds(long sessionKey) {
        OffsetDateTime[] window = fetchSessionWindow(sessionKey);
        if (window == null) {
            log.error(
                    "replay bounds unavailable session_key={} reason=session_row_missing_dates "
                            + "— run POST /api/v1/ingestion/load-reference for the session's year",
                    sessionKey);
            return null;
        }

        // A day of slack either side: the advertised window and the packets that
        // were actually ingested do not always line up exactly.
        long fromMicros = offsetDateTimeToMicros(window[0].minusDays(1));
        long toMicros = offsetDateTimeToMicros(window[1].plusDays(1));

        String query =
                String.format(
                        """
            SELECT MIN(date) AS min_date, MAX(date) AS max_date
            FROM `%s.%s`
            WHERE session_key = %d
              AND date >= TIMESTAMP_MICROS(%d)
              AND date <= TIMESTAMP_MICROS(%d)
            """,
                        dataset(), TABLE, sessionKey, fromMicros, toMicros);

        try {
            TableResult result = queryRunner.query(query);

            for (FieldValueList row : result.iterateAll()) {
                if (row.get("min_date").isNull() || row.get("max_date").isNull()) {
                    return null;
                }
                return new SessionBounds(
                        sessionKey,
                        microsToOffsetDateTime(row.get("min_date").getTimestampValue()),
                        microsToOffsetDateTime(row.get("max_date").getTimestampValue()));
            }
            return null;
        } catch (Exception e) {
            // null means "this session has no telemetry", which is a real answer.
            // A failed query is not that (R5).
            throw new BigQueryAccessException(
                    "Failed to read replay bounds for session " + sessionKey, e);
        }
    }

    /** The session's advertised start and end, or null when the reference row has neither. */
    private OffsetDateTime[] fetchSessionWindow(long sessionKey) {
        String query =
                String.format(
                        """
            SELECT date_start, date_end
            FROM `%s.sessions`
            WHERE session_key = %d AND date_start IS NOT NULL
            LIMIT 1
            """,
                        dataset(), sessionKey);

        try {
            TableResult result = queryRunner.query(query);
            for (FieldValueList row : result.iterateAll()) {
                OffsetDateTime start =
                        microsToOffsetDateTime(row.get("date_start").getTimestampValue());
                OffsetDateTime end =
                        row.get("date_end").isNull()
                                ? start.plusHours(4)
                                : microsToOffsetDateTime(row.get("date_end").getTimestampValue());
                return new OffsetDateTime[] {start, end};
            }
        } catch (Exception e) {
            throw new BigQueryAccessException(
                    "Failed to read the session window for session " + sessionKey, e);
        }
        return null;
    }

    /**
     * Fetches telemetry rows within [from, to] inclusive, ordered by date ASC. No LIMIT — the time
     * window itself bounds the result set.
     */
    public List<OpenF1CarData> fetchTelemetryWindow(
            long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        long fromMicros = offsetDateTimeToMicros(from);
        long toMicros = offsetDateTimeToMicros(to);

        String query =
                String.format(
                        """
            SELECT session_key, meeting_key, date, driver_number, speed, rpm, gear, throttle, brake, drs
            FROM `%s.%s`
            WHERE session_key = %d
              AND date >= TIMESTAMP_MICROS(%d)
              AND date <= TIMESTAMP_MICROS(%d)
            ORDER BY date ASC
            """,
                        dataset(), TABLE, sessionKey, fromMicros, toMicros);

        try {
            TableResult result = queryRunner.query(query);

            List<OpenF1CarData> telemetry = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                telemetry.add(mapRowToCarData(sessionKey, row));
            }
            log.debug("Loaded {} telemetry rows for window [{} -> {}]", telemetry.size(), from, to);
            return telemetry;
        } catch (Exception e) {
            // R5: an empty list here reads to the replay engine as "this chunk has
            // no data", which is indistinguishable from a finished session.
            throw new BigQueryAccessException(
                    "Failed to read the telemetry window for session " + sessionKey, e);
        }
    }

    private OpenF1CarData mapRowToCarData(long sessionKey, FieldValueList row) {
        OpenF1CarData data = new OpenF1CarData();
        data.setSessionKey(sessionKey);
        if (!row.get("meeting_key").isNull()) {
            data.setMeetingKey(row.get("meeting_key").getLongValue());
        }
        data.setDriverNumber((int) row.get("driver_number").getLongValue());
        data.setSpeed((int) row.get("speed").getLongValue());
        data.setRpm((int) row.get("rpm").getLongValue());
        data.setGear((int) row.get("gear").getLongValue());
        data.setThrottle((int) row.get("throttle").getLongValue());
        data.setBrake((int) row.get("brake").getLongValue());
        data.setDrs((int) row.get("drs").getLongValue());

        // BigQuery TIMESTAMP columns return epoch microseconds from getTimestampValue(),
        // NOT ISO 8601 strings. getStringValue() returns e.g. "1.709394600E9" which
        // OffsetDateTime.parse() cannot handle.
        long micros = row.get("date").getTimestampValue();
        data.setDate(microsToOffsetDateTime(micros));
        return data;
    }

    static OffsetDateTime microsToOffsetDateTime(long micros) {
        return OffsetDateTime.ofInstant(
                Instant.ofEpochSecond(micros / 1_000_000, (micros % 1_000_000) * 1_000),
                ZoneOffset.UTC);
    }

    static long offsetDateTimeToMicros(OffsetDateTime odt) {
        Instant instant = odt.toInstant();
        return instant.getEpochSecond() * 1_000_000 + instant.getNano() / 1_000;
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
