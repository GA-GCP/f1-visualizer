package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.QueryParameterValue;
import com.google.cloud.bigquery.TableResult;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class RaceAnalysisService {
    private final BigQueryQueryRunner queryRunner;

    public RaceAnalysisService(BigQueryQueryRunner queryRunner) {
        this.queryRunner = queryRunner;
    }

    private static final String TABLE_NAME = "laps";

    /**
     * Fetches all lap times for a specific session, ordered by lap number. This powers the "Lap
     * Time Progression" chart.
     */
    public List<LapDataRecord> getSessionLapTimes(long sessionKey) {
        String query =
                String.format(
                        """
                SELECT
                    driver_number,
                    lap_number,
                    lap_duration,
                    sector_1_duration,
                    sector_2_duration,
                    sector_3_duration,
                    compound,
                    date_start,
                    is_pit_out_lap
                FROM `%s.%s`
                WHERE session_key = %d
                ORDER BY lap_number ASC
                """,
                        dataset(), TABLE_NAME, sessionKey);

        log.info("Executing BigQuery Analysis: Fetching laps for session {}", sessionKey);

        try {
            TableResult result =
                    queryRunner.query(
                            QueryJobConfiguration.newBuilder(query).setUseLegacySql(false));
            List<LapDataRecord> records = new ArrayList<>();

            for (FieldValueList row : result.iterateAll()) {
                records.add(
                        LapDataRecord.builder()
                                .driverNumber((int) row.get("driver_number").getLongValue())
                                .lapNumber((int) row.get("lap_number").getLongValue())
                                .lapDuration(
                                        row.get("lap_duration").isNull()
                                                ? null
                                                : row.get("lap_duration").getDoubleValue())
                                .sector1(
                                        row.get("sector_1_duration").isNull()
                                                ? null
                                                : row.get("sector_1_duration").getDoubleValue())
                                .sector2(
                                        row.get("sector_2_duration").isNull()
                                                ? null
                                                : row.get("sector_2_duration").getDoubleValue())
                                .sector3(
                                        row.get("sector_3_duration").isNull()
                                                ? null
                                                : row.get("sector_3_duration").getDoubleValue())
                                .compound(
                                        row.get("compound").isNull()
                                                ? null
                                                : row.get("compound").getStringValue())
                                .dateStart(
                                        row.get("date_start").isNull()
                                                ? null
                                                : row.get("date_start").getStringValue())
                                .isPitOutLap(
                                        row.get("is_pit_out_lap").isNull()
                                                ? null
                                                : row.get("is_pit_out_lap").getBooleanValue())
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

    /**
     * Reads the precomputed radar and career figures for one driver (P2).
     *
     * <p>This used to build a ten-CTE query per request, including {@code COUNTIF(throttle > 95)}
     * across the whole telemetry table with no partition filter — seconds of latency and bytes
     * billed that grew with every session ever ingested, for numbers that only change when a
     * session is loaded. The head-to-head page issues two of these per comparison. The ingestion
     * run now computes them; this reads roughly twenty rows.
     */
    @Cacheable(cacheNames = "driverStats", key = "#driverNumber")
    public DriverProfile.DriverStats getDriverStats(int driverNumber) {
        String query =
                String.format(
                        """
                SELECT avg_position, position_stddev, full_throttle_pct, avg_stint_length,
                       total_races, wins, podiums, total_points, best_finish, teams_list
                FROM `%s.driver_stats`
                WHERE driver_number = @driverNumber
                """,
                        dataset());

        try {
            TableResult result =
                    queryRunner.query(
                            QueryJobConfiguration.newBuilder(query)
                                    .addNamedParameter(
                                            "driverNumber",
                                            QueryParameterValue.int64(driverNumber)));

            for (FieldValueList row : result.iterateAll()) {
                return toStats(row);
            }

            // A driver with no precomputed row has not been through an ingestion
            // run; that is a real answer, not a failure.
            log.info(
                    "driver stats missing driver_number={} — no ingestion run has covered this driver",
                    driverNumber);
            return DEFAULT_STATS;
        } catch (Exception e) {
            // R5: a BigQuery outage is not "this driver is average". The caller
            // sees a 500 in the shared ProblemDetail shape instead of plausible
            // numbers that would then be cached as if they were real.
            log.error("driver stats query failed driver_number={}", driverNumber, e);
            throw new IllegalStateException("Could not read driver statistics", e);
        }
    }

    static DriverProfile.DriverStats toStats(FieldValueList row) {
        // Speed: derived from average finishing position (race pace proxy).
        // P1 avg -> 99, P5 avg -> 81, P10 -> 58, P20 -> 13
        int speed =
                row.get("avg_position").isNull()
                        ? 50
                        : clamp(
                                Math.round(
                                        100
                                                - (row.get("avg_position").getDoubleValue() - 1)
                                                        * (90.0 / 19)));

        // Consistency: STDDEV of finishing positions.
        // stddev 1 -> 93, 3 -> 79, 5 -> 65, 10 -> 30
        int consistency =
                row.get("position_stddev").isNull()
                        ? 50
                        : clamp(Math.round(100 - row.get("position_stddev").getDoubleValue() * 7));

        // Aggression: full-throttle percentage in telemetry.
        int aggression =
                row.get("full_throttle_pct").isNull()
                        ? 50
                        : clamp(Math.round(row.get("full_throttle_pct").getDoubleValue() * 1.5));

        // Tire management: average stint length.
        // 10 laps -> 32, 15 -> 48, 20 -> 64, 25 -> 80, 30+ -> 96+
        int tireMgmt =
                row.get("avg_stint_length").isNull()
                        ? 50
                        : clamp(
                                Math.round(
                                        (row.get("avg_stint_length").getDoubleValue() / 25.0)
                                                * 80));

        int totalRaces =
                row.get("total_races").isNull() ? 0 : (int) row.get("total_races").getLongValue();
        // Experience: total race entries, ceiling at 80 races.
        int experience =
                row.get("total_races").isNull()
                        ? 30
                        : (int) Math.min(99, Math.round((totalRaces / 80.0) * 99));

        List<String> teams =
                row.get("teams_list").isNull()
                        ? List.of()
                        : List.of(row.get("teams_list").getStringValue().split("\\|"));

        return DriverProfile.DriverStats.builder()
                .speed(speed)
                .consistency(consistency)
                .aggression(aggression)
                .tireMgmt(tireMgmt)
                .experience(experience)
                .wins(row.get("wins").isNull() ? 0 : (int) row.get("wins").getLongValue())
                .podiums(row.get("podiums").isNull() ? 0 : (int) row.get("podiums").getLongValue())
                .totalPoints(
                        row.get("total_points").isNull()
                                ? 0
                                : (int) row.get("total_points").getLongValue())
                .bestChampionshipFinish(
                        row.get("best_finish").isNull()
                                ? 0
                                : (int) row.get("best_finish").getLongValue())
                .totalRaces(totalRaces)
                .teamsDrivenFor(teams)
                .build();
    }

    private static int clamp(long score) {
        return (int) Math.min(99, Math.max(10, score));
    }

    /** What a driver with no precomputed row looks like. */
    static final DriverProfile.DriverStats DEFAULT_STATS =
            DriverProfile.DriverStats.builder()
                    .speed(50)
                    .consistency(50)
                    .aggression(50)
                    .tireMgmt(50)
                    .experience(30)
                    .wins(0)
                    .podiums(0)
                    .totalPoints(0)
                    .bestChampionshipFinish(0)
                    .totalRaces(0)
                    .teamsDrivenFor(List.of())
                    .build();

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
