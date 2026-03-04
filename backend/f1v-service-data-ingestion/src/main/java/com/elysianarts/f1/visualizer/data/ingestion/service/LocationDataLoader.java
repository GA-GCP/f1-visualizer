package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.client.OpenF1Client;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1LocationData;
import com.elysianarts.f1.visualizer.commons.api.openf1.dto.OpenF1Session;
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
public class LocationDataLoader {

    private final OpenF1Client openF1Client;
    private final BigQuery bigQuery;

    private static final String DATASET = "f1_dataset";
    private static final String TABLE = "locations";
    private static final int BATCH_SIZE = 500;

    public void loadLocationsIntoBigQuery(long sessionKey) {
        log.info("📍 Fetching Location Data for Session {}...", sessionKey);

        OpenF1Session sessionMeta = openF1Client.getSession(sessionKey).block();

        if (sessionMeta == null || sessionMeta.getDateStart() == null) {
            log.warn("⚠️ Could not find valid session metadata for key: {}", sessionKey);
            return;
        }

        OffsetDateTime windowStart = sessionMeta.getDateStart();
        OffsetDateTime raceEnd = sessionMeta.getDateEnd() != null ? sessionMeta.getDateEnd() : windowStart.plusHours(2);

        log.info("🚀 Starting Location Ingestion for Session {} ({} to {})...", sessionKey, windowStart, raceEnd);

        int totalPacketsIngested = 0;

        while (windowStart.isBefore(raceEnd)) {
            OffsetDateTime windowEnd = windowStart.plusMinutes(15);
            if (windowEnd.isAfter(raceEnd)) windowEnd = raceEnd;

            log.info("⏳ Fetching location window: {} -> {}", windowStart, windowEnd);
            try {
                List<OpenF1LocationData> data = openF1Client.getLocationData(sessionKey, windowStart, windowEnd).collectList().block();

                if (data != null && !data.isEmpty()) {
                    totalPacketsIngested += data.size();
                    List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();

                    for (OpenF1LocationData packet : data) {
                        Map<String, Object> rowContent = new HashMap<>();
                        rowContent.put("session_key", packet.getSessionKey());
                        rowContent.put("meeting_key", packet.getMeetingKey());
                        rowContent.put("date", packet.getDate().toString());
                        rowContent.put("driver_number", packet.getDriverNumber());
                        rowContent.put("x", packet.getX());
                        rowContent.put("y", packet.getY());
                        rowContent.put("z", packet.getZ());

                        rows.add(InsertAllRequest.RowToInsert.of(rowContent));

                        if (rows.size() >= BATCH_SIZE) {
                            flushToBigQuery(rows);
                            rows.clear();
                        }
                    }
                    if (!rows.isEmpty()) flushToBigQuery(rows);
                }
            } catch (Exception e) {
                log.error("❌ Failed to fetch location window {} -> {}: {}", windowStart, windowEnd, e.getMessage());
            }

            windowStart = windowEnd;

            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        log.info("✅ Location Hydration Complete! Loaded {} rows into BigQuery `f1_dataset.locations`.", totalPacketsIngested);
    }

    private void flushToBigQuery(List<InsertAllRequest.RowToInsert> rows) {
        InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, TABLE).setRows(rows).build();
        InsertAllResponse response = bigQuery.insertAll(request);

        if (response.hasErrors()) {
            log.error("❌ BigQuery Insert Errors on locations batch: {}", response.getInsertErrors());
        }
    }
}
