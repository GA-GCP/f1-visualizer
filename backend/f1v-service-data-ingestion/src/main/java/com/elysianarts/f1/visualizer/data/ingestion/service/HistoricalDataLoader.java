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

    @Async
    public void loadSessionIntoBigQuery(long sessionKey) {
        log.info("⏳ Starting batch ingestion for Session {} into BigQuery...", sessionKey);

        // Fetch the first 5 minutes of data for a specific driver (Max Verstappen) just to populate the DB for our UI
        OffsetDateTime start = OffsetDateTime.of(2023, 9, 17, 12, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = start.plusMinutes(5);

        List<OpenF1CarData> data = openF1Client.getCarData(sessionKey, start, end)
                // Filter to driver 1 just to keep the initial load manageable
                .filter(d -> d.getDriverNumber() != null && d.getDriverNumber() == 1)
                .collectList().block();

        if (data == null || data.isEmpty()) {
            log.warn("⚠️ No data found for session {} in that window.", sessionKey);
            return;
        }

        log.info("📦 Received {} telemetry packets. Inserting to BigQuery...", data.size());

        InsertAllRequest.Builder requestBuilder = InsertAllRequest.newBuilder(DATASET, TABLE);

        for (OpenF1CarData packet : data) {
            Map<String, Object> row = new HashMap<>();
            row.put("session_key", packet.getSessionKey());
            row.put("date", packet.getDate().toString());
            row.put("driver_number", packet.getDriverNumber());
            row.put("speed", packet.getSpeed());
            row.put("rpm", packet.getRpm());
            row.put("gear", packet.getGear());
            row.put("throttle", packet.getThrottle());
            row.put("brake", packet.getBrake());
            row.put("drs", packet.getDrs());

            requestBuilder.addRow(row);
        }

        InsertAllResponse response = bigQuery.insertAll(requestBuilder.build());

        if (response.hasErrors()) {
            log.error("❌ BigQuery Insert Errors: {}", response.getInsertErrors());
        } else {
            log.info("✅ Successfully loaded {} rows into BigQuery `f1_dataset.telemetry`.", data.size());
        }
    }
}
