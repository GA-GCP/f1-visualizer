package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class RaceAnalysisService {
    private final BigQuery bigQuery;

    public RaceAnalysisService(BigQuery bigQuery) {
        this.bigQuery = bigQuery;
    }

    // TODO: Move project/dataset names to application.yml properties
    private static final String DATASET_NAME = "f1_dataset";
    private static final String TABLE_NAME = "laps";

    /**
     * Fetches all lap times for a specific session, ordered by lap number.
     * This powers the "Lap Time Progression" chart.
     */
    public List<LapDataRecord> getSessionLapTimes(long sessionKey) {
        String query = String.format("""
                SELECT
                    driver_number,
                    lap_number,
                    lap_duration,
                    sector_1_duration,
                    sector_2_duration,
                    sector_3_duration
                FROM `%s.%s`
                WHERE session_key = %d
                ORDER BY lap_number ASC
                """, DATASET_NAME, TABLE_NAME, sessionKey);

        log.info("Executing BigQuery Analysis: Fetching laps for session {}", sessionKey);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query)
                    .setUseLegacySql(false)
                    .build();

            TableResult result = bigQuery.query(queryConfig);
            List<LapDataRecord> records = new ArrayList<>();

            for (FieldValueList row : result.iterateAll()) {
                records.add(LapDataRecord.builder()
                        .driverNumber((int) row.get("driver_number").getLongValue())
                        .lapNumber((int) row.get("lap_number").getLongValue())
                        .lapDuration(row.get("lap_duration").isNull() ? null : row.get("lap_duration").getDoubleValue())
                        .sector1(row.get("sector_1_duration").isNull() ? null : row.get("sector_1_duration").getDoubleValue())
                        .sector2(row.get("sector_2_duration").isNull() ? null : row.get("sector_2_duration").getDoubleValue())
                        .sector3(row.get("sector_3_duration").isNull() ? null : row.get("sector_3_duration").getDoubleValue())
                        .build());
            }

            log.info("BigQuery returned {} rows.", records.size());
            return records;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("BigQuery query interrupted", e);
        } catch (Exception e) {
            log.error("BigQuery execution failed", e);
            throw new RuntimeException("Failed to fetch analysis data", e);
        }
    }

    public DriverProfile.DriverStats getDriverStats(int driverNumber) {
        String query = String.format("""
                SELECT
                  (SELECT MAX(speed) FROM `%s.telemetry` WHERE driver_number = %d) as max_speed,
                  (SELECT STDDEV(lap_duration) FROM `%s.laps` WHERE driver_number = %d AND lap_duration IS NOT NULL) as lap_stddev,
                  (SELECT COUNT(DISTINCT session_key) FROM `%s.laps` WHERE driver_number = %d) as sessions_participated
                """, DATASET_NAME, driverNumber, DATASET_NAME, driverNumber, DATASET_NAME, driverNumber);

        log.info("Executing BigQuery Analysis: Aggregating stats for driver {}", driverNumber);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            // Default fallback stats in case they have no data in BQ yet
            int speedScore = 80;
            int consistencyScore = 80;
            int experienceScore = 50;

            for (FieldValueList row : result.iterateAll()) {
                if (!row.get("max_speed").isNull()) {
                    // Normalize speed (e.g., 350 km/h = 99 score)
                    double maxSpeed = row.get("max_speed").getDoubleValue();
                    speedScore = (int) Math.min(99, (maxSpeed / 350.0) * 100);
                }
                if (!row.get("lap_stddev").isNull()) {
                    // Normalize consistency (lower standard deviation = higher consistency)
                    double stdDev = row.get("lap_stddev").getDoubleValue();
                    consistencyScore = (int) Math.max(10, 100 - (stdDev * 10));
                }
                if (!row.get("sessions_participated").isNull()) {
                    // 20+ sessions = 99 experience
                    long sessions = row.get("sessions_participated").getLongValue();
                    experienceScore = (int) Math.min(99, (sessions / 20.0) * 100);
                }
            }

            return DriverProfile.DriverStats.builder()
                    .speed(speedScore)
                    .consistency(consistencyScore)
                    .experience(experienceScore)
                    .aggression(85) // Placeholder for advanced ML logic
                    .tireMgmt(85)   // Placeholder for advanced ML logic
                    .wins((int) (Math.random() * 10)) // Placeholder until Race Results table exists
                    .podiums((int) (Math.random() * 20))
                    .build();

        } catch (Exception e) {
            log.error("Failed to aggregate stats for driver {}", driverNumber, e);
            // Return defaults if BQ fails
            return DriverProfile.DriverStats.builder().speed(80).consistency(80).aggression(80).tireMgmt(80).experience(50).wins(0).podiums(0).build();
        }
    }
}
