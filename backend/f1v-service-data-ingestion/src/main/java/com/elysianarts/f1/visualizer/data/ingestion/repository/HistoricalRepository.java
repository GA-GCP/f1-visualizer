package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.data.ingestion.model.SessionBounds;
import com.google.cloud.bigquery.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Repository
@RequiredArgsConstructor
public class HistoricalRepository {

    private final BigQuery bigQuery;
    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "telemetry";

    /**
     * Fetches the MIN/MAX date bounds for a session's telemetry data.
     * Returns null if the session has no data.
     */
    public SessionBounds fetchTelemetryBounds(long sessionKey) {
        String query = String.format("""
            SELECT MIN(date) AS min_date, MAX(date) AS max_date
            FROM `%s.%s`
            WHERE session_key = %d
            """, DATASET, TABLE, sessionKey);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            for (FieldValueList row : result.iterateAll()) {
                if (row.get("min_date").isNull() || row.get("max_date").isNull()) {
                    return null;
                }
                long minMicros = row.get("min_date").getTimestampValue();
                long maxMicros = row.get("max_date").getTimestampValue();
                return new SessionBounds(
                    sessionKey,
                    microsToOffsetDateTime(minMicros),
                    microsToOffsetDateTime(maxMicros)
                );
            }
            return null;
        } catch (Exception e) {
            log.error("Failed to fetch telemetry bounds for session {}", sessionKey, e);
            return null;
        }
    }

    /**
     * Fetches telemetry rows within [from, to] inclusive, ordered by date ASC.
     * No LIMIT — the time window itself bounds the result set.
     */
    public List<OpenF1CarData> fetchTelemetryWindow(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        long fromMicros = offsetDateTimeToMicros(from);
        long toMicros = offsetDateTimeToMicros(to);

        String query = String.format("""
            SELECT session_key, meeting_key, date, driver_number, speed, rpm, gear, throttle, brake, drs
            FROM `%s.%s`
            WHERE session_key = %d
              AND date >= TIMESTAMP_MICROS(%d)
              AND date <= TIMESTAMP_MICROS(%d)
            ORDER BY date ASC
            """, DATASET, TABLE, sessionKey, fromMicros, toMicros);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            List<OpenF1CarData> telemetry = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                telemetry.add(mapRowToCarData(sessionKey, row));
            }
            log.debug("Loaded {} telemetry rows for window [{} -> {}]", telemetry.size(), from, to);
            return telemetry;
        } catch (Exception e) {
            log.error("Failed to fetch telemetry window for session {}", sessionKey, e);
            return List.of();
        }
    }

    /**
     * Fetches all telemetry for a session. Retained for backward compatibility.
     */
    public List<OpenF1CarData> fetchSessionTelemetry(long sessionKey) {
        log.info("Fetching historical telemetry for session: {}", sessionKey);

        String query = String.format("""
            SELECT session_key, meeting_key, date, driver_number, speed, rpm, gear, throttle, brake, drs
            FROM `%s.%s`
            WHERE session_key = %d
            ORDER BY date ASC
            LIMIT 200000
            """, DATASET, TABLE, sessionKey);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            List<OpenF1CarData> telemetry = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                telemetry.add(mapRowToCarData(sessionKey, row));
            }
            log.info("Loaded {} historical packets.", telemetry.size());
            return telemetry;
        } catch (Exception e) {
            log.error("Failed to query BigQuery", e);
            return List.of();
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
}
