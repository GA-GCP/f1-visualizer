package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LapData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1StintData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LapDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQueryBatchWriter batchWriter;
    private final BigQueryQueryRunner queryRunner;

    private static final String TABLE = "laps";

    public void loadLapsIntoBigQuery(long sessionKey) {
        log.info("lap load starting session_key={}", sessionKey);

        try {
            List<OpenF1LapData> laps = openF1Client.getLapData(sessionKey);

            if (laps == null || laps.isEmpty()) {
                log.warn("lap load skipped session_key={} reason=no_lap_data", sessionKey);
                return;
            }

            // Fetch stint data to enrich laps with tire compound
            Map<String, String> compoundLookup = buildCompoundLookup(sessionKey);

            // R4: the lap-times chart doubled every time a session was re-loaded.
            deleteExistingRows(sessionKey);

            List<Map<String, Object>> rows = new ArrayList<>();
            for (OpenF1LapData lap : laps) {
                Map<String, Object> rowContent = new HashMap<>();
                rowContent.put("session_key", lap.getSessionKey());
                rowContent.put("meeting_key", lap.getMeetingKey());
                rowContent.put("driver_number", lap.getDriverNumber());
                rowContent.put("lap_number", lap.getLapNumber());
                rowContent.put("lap_duration", lap.getLapDuration());
                rowContent.put("sector_1_duration", lap.getSector1Duration());
                rowContent.put("sector_2_duration", lap.getSector2Duration());
                rowContent.put("sector_3_duration", lap.getSector3Duration());

                if (lap.getDateStart() != null) {
                    rowContent.put("date_start", lap.getDateStart().toString());
                }
                if (lap.getIsPitOutLap() != null) {
                    rowContent.put("is_pit_out_lap", lap.getIsPitOutLap());
                }

                // Look up tire compound from stint data
                String key = lap.getDriverNumber() + ":" + lap.getLapNumber();
                String compound = compoundLookup.get(key);
                if (compound != null) {
                    rowContent.put("compound", compound);
                }

                rows.add(rowContent);
            }

            batchWriter.append(dataset(), TABLE, rows);
            log.info("lap load complete session_key={} rows={} table={}.{}", sessionKey, rows.size(), dataset(), TABLE);
        } catch (Exception e) {
            log.error("lap load failed session_key={}", sessionKey, e);
        }
    }

    /**
     * Builds a lookup map from (driverNumber:lapNumber) -> compound by fetching
     * stint data from the OpenF1 /stints endpoint.
     */
    private Map<String, String> buildCompoundLookup(long sessionKey) {
        Map<String, String> lookup = new HashMap<>();
        try {
            List<OpenF1StintData> stints = openF1Client.getStintData(sessionKey);
            if (stints != null) {
                for (OpenF1StintData stint : stints) {
                    if (stint.getCompound() != null && stint.getLapStart() != null && stint.getLapEnd() != null) {
                        for (int lap = stint.getLapStart(); lap <= stint.getLapEnd(); lap++) {
                            lookup.put(stint.getDriverNumber() + ":" + lap, stint.getCompound());
                        }
                    }
                }
                log.info("compound lookup built mappings={} stints={}", lookup.size(), stints.size());
            }
        } catch (Exception e) {
            log.warn("stint fetch failed session_key={} — laps will load without compound", sessionKey, e);
        }
        return lookup;
    }

    /**
     * R4: clears the session's rows so a re-run replaces rather than duplicates.
     * Safe because batch loads, unlike streaming inserts, leave no rows in a
     * buffer that DML cannot touch.
     */
    private void deleteExistingRows(long sessionKey) {
        String sql = String.format("DELETE FROM `%s.%s` WHERE session_key = %d", dataset(), TABLE, sessionKey);
        try {
            queryRunner.query(sql);
        } catch (Exception e) {
            throw new IllegalStateException("Could not clear existing rows in " + TABLE
                    + " for session " + sessionKey, e);
        }
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
