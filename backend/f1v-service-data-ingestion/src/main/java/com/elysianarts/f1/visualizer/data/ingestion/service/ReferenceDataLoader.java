package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.google.cloud.bigquery.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ReferenceDataLoader {

    private final WebClient webClient;
    private final OpenF1AuthService authService;
    private final BigQuery bigQuery;

    private static final String DATASET = "f1_dataset";

    @Autowired
    public ReferenceDataLoader(WebClient.Builder webClientBuilder, OpenF1AuthService authService, BigQuery bigQuery) {
        this.webClient = webClientBuilder.baseUrl("https://api.openf1.org/v1").build();
        this.authService = authService;
        this.bigQuery = bigQuery;
    }

    // Testing Constructor
    public ReferenceDataLoader(WebClient webClient, OpenF1AuthService authService, BigQuery bigQuery) {
        this.webClient = webClient;
        this.authService = authService;
        this.bigQuery = bigQuery;
    }

    public void loadReferenceData(int year) {
        log.info("⬇️ Initiating Reference Data Hydration for year {}...", year);
        String token = authService.getAccessToken();

        // 1. Fetch meetings first to build a meeting_key -> meeting_name lookup
        // (The /sessions endpoint does not include meeting_name; it lives on /meetings)
        Map<Object, String> meetingNameLookup = buildMeetingNameLookup(year, token);

        // 2. Fetch & Load Sessions
        try {
            List<Map> sessions = webClient.get()
                    .uri("/sessions?year=" + year)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().bodyToFlux(Map.class).collectList().block();

            if (sessions != null && !sessions.isEmpty()) {
                deleteExistingData("sessions", "year = " + year);

                List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();
                for (Map s : sessions) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("session_key", s.get("session_key"));
                    row.put("session_name", s.get("session_name"));
                    row.put("meeting_key", s.get("meeting_key"));
                    row.put("meeting_name", meetingNameLookup.get(s.get("meeting_key")));
                    row.put("year", s.get("year"));
                    row.put("country_name", s.get("country_name"));
                    rows.add(InsertAllRequest.RowToInsert.of(row));
                }
                flushToBigQuery("sessions", rows);
            }
        } catch (Exception e) {
            log.error("❌ Failed to fetch sessions for year {}: {}", year, e.getMessage());
        }

        // 3. Fetch & Load Drivers (Using 'latest' session to get the current grid)
        try {
            List<Map> drivers = webClient.get()
                    .uri("/drivers?session_key=latest")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().bodyToFlux(Map.class).collectList().block();

            if (drivers != null && !drivers.isEmpty()) {
                deleteExistingData("drivers", "1=1");

                List<InsertAllRequest.RowToInsert> rows = new ArrayList<>();
                for (Map d : drivers) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("driver_number", d.get("driver_number"));
                    row.put("broadcast_name", d.get("broadcast_name"));
                    row.put("name_acronym", d.get("name_acronym"));
                    row.put("team_name", d.get("team_name"));
                    row.put("team_colour", d.get("team_colour"));
                    row.put("country_code", d.get("country_code"));
                    rows.add(InsertAllRequest.RowToInsert.of(row));
                }
                flushToBigQuery("drivers", rows);
            }
        } catch (Exception e) {
            log.error("❌ Failed to fetch drivers: {}", e.getMessage());
        }
    }

    private Map<Object, String> buildMeetingNameLookup(int year, String token) {
        Map<Object, String> lookup = new HashMap<>();
        try {
            List<Map> meetings = webClient.get()
                    .uri("/meetings?year=" + year)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().bodyToFlux(Map.class).collectList().block();
            if (meetings != null) {
                for (Map m : meetings) {
                    Object meetingKey = m.get("meeting_key");
                    String meetingName = (String) m.get("meeting_name");
                    if (meetingKey != null && meetingName != null) {
                        lookup.put(meetingKey, meetingName);
                    }
                }
                log.info("🏁 Built meeting name lookup with {} entries for year {}", lookup.size(), year);
            }
        } catch (Exception e) {
            log.warn("⚠️ Could not fetch meetings for name enrichment: {}", e.getMessage());
        }
        return lookup;
    }

    private void deleteExistingData(String table, String whereClause) {
        String sql = String.format("DELETE FROM `%s.%s` WHERE %s", DATASET, table, whereClause);
        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(sql).build();
            bigQuery.query(queryConfig);
            log.info("🗑️ Cleared existing rows from {} (WHERE {})", table, whereClause);
        } catch (Exception e) {
            log.warn("⚠️ Could not clear existing data from {} (may be empty): {}", table, e.getMessage());
        }
    }

    private void flushToBigQuery(String table, List<InsertAllRequest.RowToInsert> rows) {
        InsertAllRequest request = InsertAllRequest.newBuilder(DATASET, table).setRows(rows).build();
        InsertAllResponse response = bigQuery.insertAll(request);
        if (response.hasErrors()) {
            log.error("❌ BigQuery Insert Errors on {}: {}", table, response.getInsertErrors());
        } else {
            log.info("✅ Successfully hydrated {} rows into {}", rows.size(), table);
        }
    }
}
