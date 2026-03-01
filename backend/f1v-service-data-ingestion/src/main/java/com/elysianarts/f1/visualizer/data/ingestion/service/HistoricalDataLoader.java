package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1CarData;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.InsertAllRequest;
import com.google.cloud.bigquery.InsertAllResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoricalDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQuery bigQuery;

    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "telemetry";
    private static final int BATCH_SIZE = 500;

    public void loadSessionIntoBigQuery(long sessionKey) {
        log.info("⏳ Fetching metadata for Session {}...", sessionKey);

        var sessionMeta = openF1Client.getSession(sessionKey).block();

        if (sessionMeta == null || sessionMeta.getDateStart() == null) {
            log.warn("⚠️ Could not find valid session metadata for key: {}", sessionKey);
            return;
        }

        OffsetDateTime windowStart = sessionMeta.getDateStart();
        // Fallback to a 2-hour window if the API hasn't populated the end date yet
        OffsetDateTime raceEnd = sessionMeta.getDateEnd() != null ? sessionMeta.getDateEnd() : windowStart.plusHours(2);

        log.info("🚀 Starting Full Race Ingestion for Session {} ({} to {}) into BigQuery...", sessionKey, windowStart, raceEnd);

        int totalPacketsIngested = 0;

        // Loop in 15-minute chunks to safely extract data without triggering API payload limits
        while (windowStart.isBefore(raceEnd)) {
            OffsetDateTime windowEnd = windowStart.plusMinutes(15);
            if (windowEnd.isAfter(raceEnd)) windowEnd = raceEnd;

            log.info("⏳ Fetching time window: {} -> {}", windowStart, windowEnd);
            List<OpenF1CarData> data = openF1Client.getCarData(sessionKey, windowStart, windowEnd).collectList().block();

            if (data != null && !data.isEmpty()) {
                totalPacketsIngested += data.size();
                List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();

                for (OpenF1CarData packet : data) {
                    Map<String, Object> rowContent = new HashMap<>();
                    rowContent.put("session_key", packet.getSessionKey());
                    rowContent.put("date", packet.getDate().toString());
                    rowContent.put("driver_number", packet.getDriverNumber());
                    rowContent.put("speed", packet.getSpeed());
                    rowContent.put("rpm", packet.getRpm());
                    rowContent.put("gear", packet.getGear());
                    rowContent.put("throttle", packet.getThrottle());
                    rowContent.put("brake", packet.getBrake());
                    rowContent.put("drs", packet.getDrs());

                    rows.add(InsertAllRequest.RowToInsert.of(rowContent));

                    if (rows.size() >= BATCH_SIZE) {
                        flushToBigQuery(rows);
                        rows.clear();
                    }
                }
                if (!rows.isEmpty()) flushToBigQuery(rows);
            }

            // Move to the next chunk
            windowStart = windowEnd;

            // Polite delay to respect API rate limits even on sponsor tier
            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        log.info("✅ Hydration Complete! Successfully loaded {} total rows into BigQuery `f1_dataset.telemetry`.", totalPacketsIngested);
    }

    private void flushToBigQuery(List<InsertAllRequest.RowToInsert> rows) {
        InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, TABLE).setRows(rows).build();
        InsertAllResponse response = bigQuery.insertAll(request);

        if (response.hasErrors()) {
            log.error("❌ BigQuery Insert Errors on batch: {}", response.getInsertErrors());
        }
    }
}