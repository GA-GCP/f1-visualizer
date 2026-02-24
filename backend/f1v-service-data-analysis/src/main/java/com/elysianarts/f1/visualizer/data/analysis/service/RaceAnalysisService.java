package com.elysianarts.f1.visualizer.data.analysis.service;

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
}
