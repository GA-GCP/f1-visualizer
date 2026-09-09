package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class LocationDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQueryBatchWriter batchWriter;
    private final BigQueryQueryRunner queryRunner;
    /** See {@link HistoricalDataLoader} — zero in tests, 500 ms in production (T2). */
    private final Duration windowDelay;

    private static final String TABLE = "locations";
    private static final int BATCH_SIZE = 500;

    public LocationDataLoader(OpenF1Client openF1Client,
                              BigQueryBatchWriter batchWriter,
                              BigQueryQueryRunner queryRunner,
                              @Value("${f1v.openf1.window-delay:500ms}") Duration windowDelay) {
        this.openF1Client = openF1Client;
        this.batchWriter = batchWriter;
        this.queryRunner = queryRunner;
        this.windowDelay = windowDelay;
    }

    public void loadLocationsIntoBigQuery(long sessionKey) {
        log.info("location load starting session_key={}", sessionKey);

        OpenF1Session sessionMeta = openF1Client.getSession(sessionKey).orElse(null);

        if (sessionMeta == null || sessionMeta.getDateStart() == null) {
            log.warn("location load skipped session_key={} reason=no_session_metadata", sessionKey);
            return;
        }

        OffsetDateTime windowStart = sessionMeta.getDateStart();
        OffsetDateTime raceEnd = sessionMeta.getDateEnd() != null ? sessionMeta.getDateEnd() : windowStart.plusHours(2);

        log.info("location load window session_key={} from={} to={}", sessionKey, windowStart, raceEnd);

        // R4: replace what a previous run wrote rather than duplicating it.
        deleteExistingRows(sessionKey, windowStart, raceEnd);

        int totalPacketsIngested = 0;

        while (windowStart.isBefore(raceEnd)) {
            OffsetDateTime windowEnd = windowStart.plusMinutes(15);
            if (windowEnd.isAfter(raceEnd)) windowEnd = raceEnd;

            log.debug("location fetching from={} to={}", windowStart, windowEnd);
            try {
                List<OpenF1LocationData> data = openF1Client.getLocationData(sessionKey, windowStart, windowEnd);

                if (data != null && !data.isEmpty()) {
                    totalPacketsIngested += data.size();
                    List<Map<String, Object>> rows = new ArrayList<>();

                    for (OpenF1LocationData packet : data) {
                        Map<String, Object> rowContent = new HashMap<>();
                        rowContent.put("session_key", packet.getSessionKey());
                        rowContent.put("meeting_key", packet.getMeetingKey());
                        rowContent.put("date", packet.getDate().toString());
                        rowContent.put("driver_number", packet.getDriverNumber());
                        rowContent.put("x", packet.getX());
                        rowContent.put("y", packet.getY());
                        rowContent.put("z", packet.getZ());

                        rows.add(rowContent);

                        if (rows.size() >= BATCH_SIZE) {
                            batchWriter.append(dataset(), TABLE, rows);
                            rows.clear();
                        }
                    }
                    if (!rows.isEmpty()) batchWriter.append(dataset(), TABLE, rows);
                }
            } catch (Exception e) {
                log.error("location window failed session_key={} from={} to={}", sessionKey, windowStart, windowEnd, e);
            }

            windowStart = windowEnd;

            pauseBetweenWindows();
        }

        log.info("location load complete session_key={} rows={} table={}.{}",
                sessionKey, totalPacketsIngested, dataset(), TABLE);
    }

    private void pauseBetweenWindows() {
        if (windowDelay.isZero() || windowDelay.isNegative()) return;
        try {
            Thread.sleep(windowDelay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * See {@link HistoricalDataLoader} — replace rather than duplicate, with the
     * date range the partitioned table requires (R4, P2).
     */
    private void deleteExistingRows(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        String sql = String.format("""
                DELETE FROM `%s.%s`
                WHERE session_key = %d
                  AND date >= TIMESTAMP('%s')
                  AND date <= TIMESTAMP('%s')
                """, dataset(), TABLE, sessionKey, from.minusDays(1), to.plusDays(1));
        try {
            queryRunner.query(sql);
            log.info("location rows cleared session_key={}", sessionKey);
        } catch (Exception e) {
            throw new IllegalStateException("Could not clear existing locations for session " + sessionKey, e);
        }
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
