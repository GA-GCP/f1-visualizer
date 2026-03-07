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
                    sector_3_duration,
                    compound
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
                        .compound(row.get("compound").isNull() ? null : row.get("compound").getStringValue())
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
        // Single CTE-based query that computes all radar metrics + new career data points.
        // Radar formulas were redesigned to produce meaningful differentiation between drivers:
        //   Speed      → based on average finishing position (race pace proxy), not max telemetry speed
        //   Consistency → based on STDDEV of finishing positions, not noisy lap-time variance
        //   Aggression  → based on full-throttle percentage from telemetry
        //   Tire Mgmt   → based on average stint length with recalibrated scale
        //   Experience  → based on total race entries with higher ceiling (80 races, not 20 sessions)
        String query = String.format("""
                WITH
                avg_pos AS (
                  SELECT AVG(position) as avg_position
                  FROM `%s.results`
                  WHERE driver_number = %d AND position IS NOT NULL
                ),
                pos_consistency AS (
                  SELECT STDDEV(position) as position_stddev
                  FROM `%s.results`
                  WHERE driver_number = %d AND position IS NOT NULL
                ),
                throttle_stats AS (
                  SELECT COUNTIF(throttle > 95) * 100.0 / NULLIF(COUNT(*), 0) as full_throttle_pct
                  FROM `%s.telemetry`
                  WHERE driver_number = %d
                ),
                stint_avg AS (
                  SELECT AVG(stint_len) as avg_stint_length
                  FROM (
                    SELECT COUNT(*) as stint_len
                    FROM `%s.laps`
                    WHERE driver_number = %d AND compound IS NOT NULL AND lap_duration IS NOT NULL
                    GROUP BY session_key, compound
                  )
                ),
                race_counts AS (
                  SELECT COUNT(DISTINCT session_key) as total_races
                  FROM `%s.results`
                  WHERE driver_number = %d
                ),
                win_podium AS (
                  SELECT
                    COUNTIF(position = 1) as wins,
                    COUNTIF(position <= 3) as podiums
                  FROM `%s.results`
                  WHERE driver_number = %d
                ),
                career_points AS (
                  SELECT COALESCE(SUM(CASE
                    WHEN position = 1 THEN 25 WHEN position = 2 THEN 18 WHEN position = 3 THEN 15
                    WHEN position = 4 THEN 12 WHEN position = 5 THEN 10 WHEN position = 6 THEN 8
                    WHEN position = 7 THEN 6 WHEN position = 8 THEN 4
                    WHEN position = 9 THEN 2 WHEN position = 10 THEN 1 ELSE 0
                  END), 0) as total_points
                  FROM `%s.results`
                  WHERE driver_number = %d
                ),
                all_season_points AS (
                  SELECT s.year, r.driver_number,
                    SUM(CASE
                      WHEN r.position = 1 THEN 25 WHEN r.position = 2 THEN 18 WHEN r.position = 3 THEN 15
                      WHEN r.position = 4 THEN 12 WHEN r.position = 5 THEN 10 WHEN r.position = 6 THEN 8
                      WHEN r.position = 7 THEN 6 WHEN r.position = 8 THEN 4
                      WHEN r.position = 9 THEN 2 WHEN r.position = 10 THEN 1 ELSE 0
                    END) as season_points
                  FROM `%s.results` r
                  JOIN `%s.sessions` s ON r.session_key = s.session_key
                  WHERE s.session_name = 'Race'
                  GROUP BY s.year, r.driver_number
                ),
                championship_ranks AS (
                  SELECT year, driver_number,
                    RANK() OVER (PARTITION BY year ORDER BY season_points DESC) as championship_pos
                  FROM all_season_points
                ),
                best_championship AS (
                  SELECT MIN(championship_pos) as best_finish
                  FROM championship_ranks
                  WHERE driver_number = %d
                ),
                teams AS (
                  SELECT STRING_AGG(DISTINCT team_name, '|' ORDER BY team_name) as teams_list
                  FROM `%s.session_drivers`
                  WHERE driver_number = %d AND team_name IS NOT NULL
                )
                SELECT
                  ap.avg_position,
                  pc.position_stddev,
                  ts.full_throttle_pct,
                  sa.avg_stint_length,
                  rc.total_races,
                  wp.wins,
                  wp.podiums,
                  cp.total_points,
                  bc.best_finish,
                  t.teams_list
                FROM avg_pos ap, pos_consistency pc, throttle_stats ts, stint_avg sa,
                     race_counts rc, win_podium wp, career_points cp, best_championship bc, teams t
                """,
                DATASET_NAME, driverNumber,   // avg_pos
                DATASET_NAME, driverNumber,   // pos_consistency
                DATASET_NAME, driverNumber,   // throttle_stats
                DATASET_NAME, driverNumber,   // stint_avg
                DATASET_NAME, driverNumber,   // race_counts
                DATASET_NAME, driverNumber,   // win_podium
                DATASET_NAME, driverNumber,   // career_points
                DATASET_NAME, DATASET_NAME,   // all_season_points (results + sessions join)
                driverNumber,                 // best_championship filter
                DATASET_NAME, driverNumber    // teams
        );

        log.info("Executing BigQuery Analysis: Aggregating stats for driver {}", driverNumber);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = bigQuery.query(queryConfig);

            int speedScore = 50;
            int consistencyScore = 50;
            int experienceScore = 30;
            int aggressionScore = 50;
            int tireMgmtScore = 50;
            int wins = 0;
            int podiums = 0;
            int totalPoints = 0;
            int bestChampionshipFinish = 0;
            int totalRaces = 0;
            List<String> teamsDrivenFor = List.of();

            for (FieldValueList row : result.iterateAll()) {
                // Speed: derived from average finishing position (race pace proxy)
                // P1 avg → 99, P5 avg → 81, P10 → 58, P20 → 13
                if (!row.get("avg_position").isNull()) {
                    double avgPos = row.get("avg_position").getDoubleValue();
                    speedScore = (int) Math.min(99, Math.max(10,
                            Math.round(100 - (avgPos - 1) * (90.0 / 19))));
                }

                // Consistency: derived from STDDEV of finishing positions
                // stddev 1 → 93, stddev 3 → 79, stddev 5 → 65, stddev 10 → 30
                if (!row.get("position_stddev").isNull()) {
                    double posStdDev = row.get("position_stddev").getDoubleValue();
                    consistencyScore = (int) Math.min(99, Math.max(10,
                            Math.round(100 - posStdDev * 7)));
                }

                // Aggression: derived from full-throttle percentage in telemetry
                // Higher full-throttle % = more aggressive driving style
                if (!row.get("full_throttle_pct").isNull()) {
                    double fullThrottlePct = row.get("full_throttle_pct").getDoubleValue();
                    aggressionScore = (int) Math.min(99, Math.max(10,
                            Math.round(fullThrottlePct * 1.5)));
                }

                // Tire Management: average stint length with recalibrated scale
                // 10 laps → 32, 15 laps → 48, 20 laps → 64, 25 laps → 80, 30+ laps → 96+
                if (!row.get("avg_stint_length").isNull()) {
                    double avgStintLen = row.get("avg_stint_length").getDoubleValue();
                    tireMgmtScore = (int) Math.min(99, Math.max(10,
                            Math.round((avgStintLen / 25.0) * 80)));
                }

                // Experience: total race entries, ceiling at 80 races
                if (!row.get("total_races").isNull()) {
                    totalRaces = (int) row.get("total_races").getLongValue();
                    experienceScore = (int) Math.min(99,
                            Math.round((totalRaces / 80.0) * 99));
                }

                if (!row.get("wins").isNull()) {
                    wins = (int) row.get("wins").getLongValue();
                }
                if (!row.get("podiums").isNull()) {
                    podiums = (int) row.get("podiums").getLongValue();
                }
                if (!row.get("total_points").isNull()) {
                    totalPoints = (int) row.get("total_points").getLongValue();
                }
                if (!row.get("best_finish").isNull()) {
                    bestChampionshipFinish = (int) row.get("best_finish").getLongValue();
                }
                if (!row.get("teams_list").isNull()) {
                    String teamsStr = row.get("teams_list").getStringValue();
                    teamsDrivenFor = List.of(teamsStr.split("\\|"));
                }
            }

            return DriverProfile.DriverStats.builder()
                    .speed(speedScore)
                    .consistency(consistencyScore)
                    .experience(experienceScore)
                    .aggression(aggressionScore)
                    .tireMgmt(tireMgmtScore)
                    .wins(wins)
                    .podiums(podiums)
                    .totalPoints(totalPoints)
                    .bestChampionshipFinish(bestChampionshipFinish)
                    .totalRaces(totalRaces)
                    .teamsDrivenFor(teamsDrivenFor)
                    .build();

        } catch (Exception e) {
            log.error("Failed to aggregate stats for driver {}", driverNumber, e);
            return DriverProfile.DriverStats.builder()
                    .speed(50).consistency(50).aggression(50).tireMgmt(50).experience(30)
                    .wins(0).podiums(0)
                    .totalPoints(0).bestChampionshipFinish(0).totalRaces(0).teamsDrivenFor(List.of())
                    .build();
        }
    }
}
