package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LapData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1StintData;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.InsertAllRequest;
import com.google.cloud.bigquery.InsertAllResponse;
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
    private final BigQuery bigQuery;

    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "laps";

    public void loadLapsIntoBigQuery(long sessionKey) {
        log.info("🏁 Fetching Lap Data for Session {}...", sessionKey);

        try {
            List<OpenF1LapData> laps = openF1Client.getLapData(sessionKey).collectList().block();

            if (laps == null || laps.isEmpty()) {
                log.warn("⚠️ No lap data found for session {}", sessionKey);
                return;
            }

            // Fetch stint data to enrich laps with tire compound
            Map<String, String> compoundLookup = buildCompoundLookup(sessionKey);

            List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();
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

                rows.add(InsertAllRequest.RowToInsert.of(rowContent));
            }

            // Batch insert
            InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, TABLE).setRows(rows).build();
            InsertAllResponse response = bigQuery.insertAll(request);

            if (response.hasErrors()) {
                log.error("❌ BigQuery Insert Errors on Laps: {}", response.getInsertErrors());
            } else {
                log.info("✅ Successfully loaded {} laps into BigQuery `f1_dataset.laps`.", rows.size());
            }
        } catch (Exception e) {
            log.error("❌ Failed to fetch lap data for session {}: {}", sessionKey, e.getMessage());
        }
    }

    /**
     * Builds a lookup map from (driverNumber:lapNumber) -> compound by fetching
     * stint data from the OpenF1 /stints endpoint.
     */
    private Map<String, String> buildCompoundLookup(long sessionKey) {
        Map<String, String> lookup = new HashMap<>();
        try {
            List<OpenF1StintData> stints = openF1Client.getStintData(sessionKey).collectList().block();
            if (stints != null) {
                for (OpenF1StintData stint : stints) {
                    if (stint.getCompound() != null && stint.getLapStart() != null && stint.getLapEnd() != null) {
                        for (int lap = stint.getLapStart(); lap <= stint.getLapEnd(); lap++) {
                            lookup.put(stint.getDriverNumber() + ":" + lap, stint.getCompound());
                        }
                    }
                }
                log.info("🏎️ Built compound lookup with {} lap-compound mappings from {} stints", lookup.size(), stints.size());
            }
        } catch (Exception e) {
            log.warn("⚠️ Could not fetch stint data for compound enrichment: {}", e.getMessage());
        }
        return lookup;
    }
}
