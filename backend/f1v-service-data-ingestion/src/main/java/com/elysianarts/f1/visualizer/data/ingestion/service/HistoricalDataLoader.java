package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class HistoricalDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQueryBatchWriter batchWriter;
    private final BigQueryQueryRunner queryRunner;

    /**
     * Rate-limit courtesy between 15-minute windows. Injected rather than a literal {@code
     * Thread.sleep(500)} because the production delay used to run for real inside the tests, where
     * two loader suites accounted for 12.7 of the 23.8 second wall time (T2).
     */
    private final Duration windowDelay;

    private static final String TABLE = "telemetry";
    private static final int BATCH_SIZE = 500;

    public HistoricalDataLoader(
            OpenF1Client openF1Client,
            BigQueryBatchWriter batchWriter,
            BigQueryQueryRunner queryRunner,
            @Value("${f1v.openf1.window-delay:500ms}") Duration windowDelay) {
        this.openF1Client = openF1Client;
        this.batchWriter = batchWriter;
        this.queryRunner = queryRunner;
        this.windowDelay = windowDelay;
    }

    public void loadSessionIntoBigQuery(long sessionKey) {
        log.info("telemetry load starting session_key={}", sessionKey);

        var sessionMeta = openF1Client.getSession(sessionKey).orElse(null);

        if (sessionMeta == null || sessionMeta.getDateStart() == null) {
            log.warn(
                    "telemetry load skipped session_key={} reason=no_session_metadata", sessionKey);
            return;
        }

        OffsetDateTime windowStart = sessionMeta.getDateStart();
        // Fallback to a 2-hour window if the API hasn't populated the end date yet
        OffsetDateTime raceEnd =
                sessionMeta.getDateEnd() != null
                        ? sessionMeta.getDateEnd()
                        : windowStart.plusHours(2);

        log.info(
                "telemetry load window session_key={} from={} to={}",
                sessionKey,
                windowStart,
                raceEnd);

        // R4: a re-run used to insert everything a second time, because nothing
        // cleared what the previous run had written. Batch loads are visible to
        // DML immediately — unlike streaming inserts, which sit in a buffer for up
        // to 90 minutes — so deleting first is reliable.
        deleteExistingRows(sessionKey, windowStart, raceEnd);

        int totalPacketsIngested = 0;

        // Loop in 15-minute chunks to safely extract data without triggering API payload limits
        while (windowStart.isBefore(raceEnd)) {
            OffsetDateTime windowEnd = windowStart.plusMinutes(15);
            if (windowEnd.isAfter(raceEnd)) windowEnd = raceEnd;

            log.debug("telemetry fetching from={} to={}", windowStart, windowEnd);
            try {
                List<OpenF1CarData> data =
                        openF1Client.getCarData(sessionKey, windowStart, windowEnd);

                if (data != null && !data.isEmpty()) {
                    totalPacketsIngested += data.size();
                    List<Map<String, Object>> rows = new ArrayList<>();

                    for (OpenF1CarData packet : data) {
                        Map<String, Object> rowContent = new HashMap<>();
                        rowContent.put("session_key", packet.getSessionKey());
                        rowContent.put("meeting_key", packet.getMeetingKey());
                        rowContent.put("date", packet.getDate().toString());
                        rowContent.put("driver_number", packet.getDriverNumber());
                        rowContent.put("speed", packet.getSpeed());
                        rowContent.put("rpm", packet.getRpm());
                        rowContent.put("gear", packet.getGear());
                        rowContent.put("throttle", packet.getThrottle());
                        rowContent.put("brake", packet.getBrake());
                        rowContent.put("drs", packet.getDrs());

                        rows.add(rowContent);

                        if (rows.size() >= BATCH_SIZE) {
                            batchWriter.append(dataset(), TABLE, rows);
                            rows.clear();
                        }
                    }
                    if (!rows.isEmpty()) batchWriter.append(dataset(), TABLE, rows);
                }
            } catch (Exception e) {
                log.error(
                        "telemetry window failed session_key={} from={} to={}",
                        sessionKey,
                        windowStart,
                        windowEnd,
                        e);
            }

            // Move to the next chunk
            windowStart = windowEnd;

            pauseBetweenWindows();
        }

        log.info(
                "telemetry load complete session_key={} rows={} table={}.{}",
                sessionKey,
                totalPacketsIngested,
                dataset(),
                TABLE);
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
     * Clears the session's existing rows so a re-run replaces rather than duplicates. The date
     * range is required, not merely an optimisation: the table demands a partition filter (P2).
     */
    private void deleteExistingRows(long sessionKey, OffsetDateTime from, OffsetDateTime to) {
        String sql =
                String.format(
                        """
                DELETE FROM `%s.%s`
                WHERE session_key = %d
                  AND date >= TIMESTAMP('%s')
                  AND date <= TIMESTAMP('%s')
                """,
                        dataset(), TABLE, sessionKey, from.minusDays(1), to.plusDays(1));
        try {
            queryRunner.query(sql);
            log.info("telemetry rows cleared session_key={}", sessionKey);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Could not clear existing telemetry for session " + sessionKey, e);
        }
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
