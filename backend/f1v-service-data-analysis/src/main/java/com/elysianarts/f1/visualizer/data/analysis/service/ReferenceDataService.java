package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final BigQuery bigQuery;
    private static final String DATASET = "f1_dataset";

    public List<RaceSession> searchSessions(String query) {
        // Query BigQuery dynamically. If query is empty, return latest.
        String sql = String.format("""
            SELECT session_key, session_name, meeting_name, year, country_name
            FROM `%s.sessions`
            WHERE LOWER(meeting_name) LIKE LOWER(@search) OR LOWER(country_name) LIKE LOWER(@search)
            ORDER BY year DESC, meeting_key DESC, session_key DESC
            LIMIT 50
            """, DATASET);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(sql)
                    .addNamedParameter("search", com.google.cloud.bigquery.QueryParameterValue.string("%" + query + "%"))
                    .build();

            TableResult result = bigQuery.query(queryConfig);
            List<RaceSession> sessions = new ArrayList<>();
            for (FieldValueList row : result.iterateAll()) {
                sessions.add(RaceSession.builder()
                        .sessionKey(row.get("session_key").getLongValue())
                        .sessionName(row.get("session_name").isNull() ? "Unknown" : row.get("session_name").getStringValue())
                        .meetingName(row.get("meeting_name").isNull() ? "Unknown" : row.get("meeting_name").getStringValue())
                        .year(row.get("year").isNull() ? 2023 : (int) row.get("year").getLongValue())
                        .countryName(row.get("country_name").isNull() ? "" : row.get("country_name").getStringValue())
                        .build());
            }
            return sessions;
        } catch (Exception e) {
            log.error("Failed to fetch sessions from BigQuery", e);
            return List.of(); // Empty fallback
        }
    }

    public List<RaceSession> getAvailableSessions() {
        return searchSessions(""); // Default to all
    }

    public List<DriverProfile> getMasterDriverList() {
        // Deduplicate drivers in case they appear in multiple sessions
        String sql = String.format("""
            SELECT driver_number, broadcast_name, team_name, team_colour, country_code
            FROM `%s.drivers`
            GROUP BY driver_number, broadcast_name, team_name, team_colour, country_code
            ORDER BY driver_number ASC
            """, DATASET);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(sql).build();
            TableResult result = bigQuery.query(queryConfig);
            List<DriverProfile> drivers = new ArrayList<>();

            for (FieldValueList row : result.iterateAll()) {
                int driverNum = (int) row.get("driver_number").getLongValue();
                String teamColor = row.get("team_colour").isNull() ? "ffffff" : row.get("team_colour").getStringValue();
                String name = row.get("broadcast_name").isNull() ? "Unknown" : row.get("broadcast_name").getStringValue();

                // Generate a 3-letter code like "VER" from their broadcast name
                String code = name.length() >= 3 ? name.substring(0, 3).toUpperCase() : String.valueOf(driverNum);

                drivers.add(DriverProfile.builder()
                        .id(driverNum)
                        .code(code)
                        .name(name)
                        .team(row.get("team_name").isNull() ? "Unknown" : row.get("team_name").getStringValue())
                        .teamColor("#" + teamColor)
                        // Note: The dynamic stats logic in RaceAnalysisService.java will overwrite this on the frontend
                        .stats(DriverProfile.DriverStats.builder().speed(80).consistency(80).aggression(80).tireMgmt(80).experience(80).wins(0).podiums(0).build())
                        .build());
            }
            return drivers;
        } catch (Exception e) {
            log.error("Failed to fetch drivers from BigQuery", e);
            return List.of();
        }
    }
}