package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.client.OpenF1Client;
import com.elysianarts.f1.visualizer.data.ingestion.model.OpenF1CarData;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.InsertAllRequest;
import com.google.cloud.bigquery.InsertAllResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    private static final int BATCH_SIZE = 500; // Safe batch limit for BigQuery inserts
    
    public void loadSessionIntoBigQuery(long sessionKey) {
        log.info("⏳ Starting heavy batch ingestion for Session {} into BigQuery...", sessionKey);

        // Fetch 15 minutes of race data for the ENTIRE grid
        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(15);

        // Notice we removed the driver filter. This gets everyone!
        List<OpenF1CarData> data = openF1Client.getCarData(sessionKey, start, end)
                .collectList().block();

        if (data == null || data.isEmpty()) {
            log.warn("⚠️ No data found for session {} in that window.", sessionKey);
            return;
        }

        log.info("📦 Received {} telemetry packets for the grid. Chunking inserts...", data.size());

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

            // Execute BQ Insert when batch size is reached to prevent memory overflow
            if (rows.size() >= BATCH_SIZE) {
                flushToBigQuery(rows);
                rows.clear();
            }
        }

        // Flush remaining rows
        if (!rows.isEmpty()) {
            flushToBigQuery(rows);
        }

        log.info("✅ Hydration Complete! Successfully loaded {} rows into BigQuery `f1_dataset.telemetry`.", data.size());
    }

    private void flushToBigQuery(List<InsertAllRequest.RowToInsert> rows) {
        InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, TABLE).setRows(rows).build();
        InsertAllResponse response = bigQuery.insertAll(request);

        if (response.hasErrors()) {
            log.error("❌ BigQuery Insert Errors on batch: {}", response.getInsertErrors());
        }
    }
}
