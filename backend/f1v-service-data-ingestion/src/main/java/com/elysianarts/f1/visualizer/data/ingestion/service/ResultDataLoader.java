package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1PositionData;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryBatchWriter;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResultDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQueryBatchWriter batchWriter;
    private final BigQueryQueryRunner queryRunner;

    private static final String TABLE = "results";

    public void loadResultsIntoBigQuery(long sessionKey) {
        log.info("result load starting session_key={}", sessionKey);

        try {
            List<OpenF1PositionData> positions = openF1Client.getPositionData(sessionKey);

            if (positions != null && !positions.isEmpty()) {
                Map<Integer, Integer> finalPositions = new HashMap<>();
                for (OpenF1PositionData pos : positions) {
                    finalPositions.put(pos.getDriverNumber(), pos.getPosition());
                }

                // R4: replace this session's results rather than adding a second set.
                deleteExistingRows(sessionKey);

                List<Map<String, Object>> rows = new ArrayList<>();
                for (Map.Entry<Integer, Integer> entry : finalPositions.entrySet()) {
                    Map<String, Object> rowContent = new HashMap<>();
                    rowContent.put("session_key", sessionKey);
                    rowContent.put("driver_number", entry.getKey());
                    rowContent.put("position", entry.getValue());

                    rows.add(rowContent);
                }

                if (!rows.isEmpty()) {
                    batchWriter.append(dataset(), TABLE, rows);
                    log.info(
                            "result load complete session_key={} rows={} table={}.{}",
                            sessionKey,
                            rows.size(),
                            dataset(),
                            TABLE);
                }
            } else {
                log.warn("result load skipped session_key={} reason=no_position_data", sessionKey);
            }
        } catch (Exception e) {
            log.error("result load failed session_key={}", sessionKey, e);
        }
    }

    /**
     * R4: clears the session's rows so a re-run replaces rather than duplicates. Safe because batch
     * loads, unlike streaming inserts, leave no rows in a buffer that DML cannot touch.
     */
    private void deleteExistingRows(long sessionKey) {
        String sql =
                String.format(
                        "DELETE FROM `%s.%s` WHERE session_key = %d", dataset(), TABLE, sessionKey);
        try {
            queryRunner.query(sql);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Could not clear existing rows in " + TABLE + " for session " + sessionKey, e);
        }
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
