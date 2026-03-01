package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1PositionData;
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
public class ResultDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQuery bigQuery;

    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "results";

    public void loadResultsIntoBigQuery(long sessionKey) {
        log.info("🏆 Fetching Final Positions for Session {}...", sessionKey);

        List<OpenF1PositionData> positions = openF1Client.getPositionData(sessionKey).collectList().block();

        if (positions != null && !positions.isEmpty()) {
            // The OpenF1 /position endpoint returns a time-series of positions throughout the race.
            // To get the final result, we'll map them by driver, overwriting until we get the last known position.
            Map<Integer, Integer> finalPositions = new HashMap<>();
            for (OpenF1PositionData pos : positions) {
                finalPositions.put(pos.getDriverNumber(), pos.getPosition());
            }

            List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();
            for (Map.Entry<Integer, Integer> entry : finalPositions.entrySet()) {
                Map<String, Object> rowContent = new HashMap<>();
                rowContent.put("session_key", sessionKey);
                rowContent.put("driver_number", entry.getKey());
                rowContent.put("position", entry.getValue());

                rows.add(InsertAllRequest.RowToInsert.of(rowContent));
            }

            if (!rows.isEmpty()) {
                InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, TABLE).setRows(rows).build();
                InsertAllResponse response = bigQuery.insertAll(request);

                if (response.hasErrors()) {
                    log.error("❌ BigQuery Insert Errors on Results: {}", response.getInsertErrors());
                } else {
                    log.info("✅ Successfully loaded {} driver results into BigQuery `f1_dataset.results`.", rows.size());
                }
            }
        } else {
            log.warn("⚠️ No position data found for session {}", sessionKey);
        }
    }
}
