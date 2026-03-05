package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.google.cloud.bigquery.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository.microsToOffsetDateTime;
import static com.elysianarts.f1.visualizer.data.ingestion.repository.HistoricalRepository.offsetDateTimeToMicros;

@Slf4j
@Repository
@RequiredArgsConstructor
public class HistoricalLocationRepository {

    private final BigQuery bigQuery;
    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "locations";

    /**
     * Fetches location rows within [from, to] inclusive, ordered by date ASC.
     * No LIMIT — the time window itself bounds the result set.
     */
    public List<OpenF1LocationData> fetchLocationWindow(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        long fromMicros = offsetDateTimeToMicros(from);
        long toMicros = offsetDateTimeToMicros(to);

        String query = String.format("""
            SELECT session_key, meeting_key, date, driver_number, x, y, z
            FROM `%s.%s`
            WHERE session_key = %d
              AND date >= TIMESTAMP_MICROS(%d)
              AND date <= TIMESTAMP_MICROS(%d)
            ORDER BY date ASC
            """, DATASET, TABLE, sessionKey, fromMicros, toMicros);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            List<OpenF1LocationData> locations = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                locations.add(mapRowToLocationData(sessionKey, row));
            }
            log.debug("Loaded {} location rows for window [{} -> {}]", locations.size(), from, to);
            return locations;
        } catch (Exception e) {
            log.error("Failed to fetch location window for session {}", sessionKey, e);
            return List.of();
        }
    }

    /**
     * Fetches all locations for a session. Retained for backward compatibility.
     */
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
                locations.add(mapRowToLocationData(sessionKey, row));
            }
            log.info("Loaded {} historical location packets.", locations.size());
            return locations;
        } catch (Exception e) {
            log.error("Failed to query BigQuery for locations", e);
            return List.of();
        }
    }

    private OpenF1LocationData mapRowToLocationData(long sessionKey, FieldValueList row) {
        OpenF1LocationData data = new OpenF1LocationData();
        data.setSessionKey(sessionKey);
        if (!row.get("meeting_key").isNull()) {
            data.setMeetingKey(row.get("meeting_key").getLongValue());
        }
        data.setDriverNumber((int) row.get("driver_number").getLongValue());
        data.setX((int) row.get("x").getLongValue());
        data.setY((int) row.get("y").getLongValue());
        data.setZ((int) row.get("z").getLongValue());

        long micros = row.get("date").getTimestampValue();
        data.setDate(microsToOffsetDateTime(micros));
        return data;
    }
}
