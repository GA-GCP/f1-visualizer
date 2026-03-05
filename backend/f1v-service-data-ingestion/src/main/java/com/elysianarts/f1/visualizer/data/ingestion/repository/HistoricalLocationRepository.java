package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
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
public class HistoricalLocationRepository {

    private final BigQuery bigQuery;
    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "locations";

    public List<OpenF1LocationData> fetchSessionLocations(long sessionKey) {
        log.info("Fetching historical location data for session: {}", sessionKey);

        String query = String.format("""
            SELECT session_key, meeting_key, date, driver_number, x, y, z
            FROM `%s.%s`
            WHERE session_key = %d
            ORDER BY date ASC
            LIMIT 200000
            """, DATASET, TABLE, sessionKey);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            List<OpenF1LocationData> locations = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                OpenF1LocationData data = new OpenF1LocationData();
                data.setSessionKey(sessionKey);
                if (!row.get("meeting_key").isNull()) {
                    data.setMeetingKey(row.get("meeting_key").getLongValue());
                }
                data.setDriverNumber((int) row.get("driver_number").getLongValue());
                data.setX((int) row.get("x").getLongValue());
                data.setY((int) row.get("y").getLongValue());
                data.setZ((int) row.get("z").getLongValue());

                // BigQuery TIMESTAMP columns return epoch microseconds from getTimestampValue(),
                // NOT ISO 8601 strings. getStringValue() returns e.g. "1.709394600E9" which
                // OffsetDateTime.parse() cannot handle.
                long micros = row.get("date").getTimestampValue();
                data.setDate(OffsetDateTime.ofInstant(
                        Instant.ofEpochSecond(micros / 1_000_000, (micros % 1_000_000) * 1_000),
                        ZoneOffset.UTC));

                locations.add(data);
            }
            log.info("Loaded {} historical location packets.", locations.size());
            return locations;

        } catch (Exception e) {
            log.error("Failed to query BigQuery for locations", e);
            return List.of();
        }
    }
}
