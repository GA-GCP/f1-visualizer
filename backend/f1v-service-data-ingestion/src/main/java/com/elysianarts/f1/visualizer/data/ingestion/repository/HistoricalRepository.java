package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
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

    public List<OpenF1CarData> fetchSessionTelemetry(long sessionKey) {
        log.info("Fetching historical telemetry for session: {}", sessionKey);

        // Fetch ordered by date so we can replay chronologically
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
                data.setDate(OffsetDateTime.ofInstant(
                        Instant.ofEpochSecond(micros / 1_000_000, (micros % 1_000_000) * 1_000),
                        ZoneOffset.UTC));

                telemetry.add(data);
            }
            log.info("Loaded {} historical packets.", telemetry.size());
            return telemetry;

        } catch (Exception e) {
            log.error("Failed to query BigQuery", e);
            return List.of();
        }
    }
}
