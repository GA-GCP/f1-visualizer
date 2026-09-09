package com.elysianarts.f1.visualizer.replay.repository;

import static com.elysianarts.f1.visualizer.replay.repository.HistoricalRepository.microsToOffsetDateTime;
import static com.elysianarts.f1.visualizer.replay.repository.HistoricalRepository.offsetDateTimeToMicros;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryAccessException;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.google.cloud.bigquery.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
@RequiredArgsConstructor
public class HistoricalLocationRepository {

    private final BigQueryQueryRunner queryRunner;
    private static final String TABLE = "locations";

    /**
     * Fetches location rows within [from, to] inclusive, ordered by date ASC. No LIMIT — the time
     * window itself bounds the result set.
     */
    public List<OpenF1LocationData> fetchLocationWindow(
            long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        long fromMicros = offsetDateTimeToMicros(from);
        long toMicros = offsetDateTimeToMicros(to);

        String query =
                String.format(
                        """
            SELECT session_key, meeting_key, date, driver_number, x, y, z
            FROM `%s.%s`
            WHERE session_key = %d
              AND date >= TIMESTAMP_MICROS(%d)
              AND date <= TIMESTAMP_MICROS(%d)
            ORDER BY date ASC
            """,
                        dataset(), TABLE, sessionKey, fromMicros, toMicros);

        try {
            TableResult result = queryRunner.query(query);

            List<OpenF1LocationData> locations = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                locations.add(mapRowToLocationData(sessionKey, row));
            }
            log.debug("Loaded {} location rows for window [{} -> {}]", locations.size(), from, to);
            return locations;
        } catch (Exception e) {
            throw new BigQueryAccessException(
                    "Failed to read the location window for session " + sessionKey, e);
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

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
