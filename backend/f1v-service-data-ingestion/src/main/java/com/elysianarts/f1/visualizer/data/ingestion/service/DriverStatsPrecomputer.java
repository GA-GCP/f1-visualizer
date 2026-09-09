package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.TableResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Computes the driver radar and career figures once per ingestion run (P2).
 *
 * <p>These numbers change only when a session is loaded, but the ten-CTE query behind them used to
 * run on every {@code /drivers/{id}/stats} request — including {@code COUNTIF(throttle > 95)}
 * across the entire telemetry table with no partition filter, so each call scanned the largest
 * table end to end and the bytes billed grew with every session ever ingested. The head-to-head
 * page issues two of them per comparison.
 *
 * <p>The same aggregation now runs here, for every driver at once, at the end of the load that
 * changes its inputs. The analysis service reads a table of roughly twenty rows instead.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DriverStatsPrecomputer {

    private final BigQueryQueryRunner queryRunner;

    /** Points for positions 1-10, used for both career totals and season ranking. */
    private static final String POINTS_CASE =
            """
            CASE
              WHEN position = 1 THEN 25 WHEN position = 2 THEN 18 WHEN position = 3 THEN 15
              WHEN position = 4 THEN 12 WHEN position = 5 THEN 10 WHEN position = 6 THEN 8
              WHEN position = 7 THEN 6 WHEN position = 8 THEN 4
              WHEN position = 9 THEN 2 WHEN position = 10 THEN 1 ELSE 0
            END""";

    public void recompute() {
        TelemetryWindow window = telemetryWindow();
        if (window == null) {
            log.warn(
                    "driver stats recompute skipped reason=no_session_dates "
                            + "— run POST /api/v1/ingestion/load-reference first");
            return;
        }

        String sql =
                String.format(
                        """
                MERGE `%1$s.driver_stats` T
                USING (
                  WITH race_results AS (
                    SELECT r.session_key, r.driver_number, r.position, s.year
                    FROM `%1$s.results` r
                    JOIN `%1$s.sessions` s ON r.session_key = s.session_key
                    WHERE s.session_name = 'Race'
                  ),
                  positions AS (
                    SELECT driver_number, AVG(position) AS avg_position, STDDEV(position) AS position_stddev
                    FROM race_results WHERE position IS NOT NULL GROUP BY driver_number
                  ),
                  races AS (
                    SELECT driver_number,
                           COUNT(DISTINCT session_key) AS total_races,
                           COUNTIF(position = 1) AS wins,
                           COUNTIF(position <= 3) AS podiums,
                           COALESCE(SUM(%2$s), 0) AS total_points
                    FROM race_results GROUP BY driver_number
                  ),
                  throttle AS (
                    SELECT driver_number,
                           COUNTIF(throttle > 95) * 100.0 / NULLIF(COUNT(*), 0) AS full_throttle_pct
                    FROM `%1$s.telemetry`
                    WHERE date >= TIMESTAMP('%3$s') AND date <= TIMESTAMP('%4$s')
                    GROUP BY driver_number
                  ),
                  stints AS (
                    SELECT driver_number, AVG(stint_len) AS avg_stint_length
                    FROM (
                      SELECT driver_number, COUNT(*) AS stint_len
                      FROM `%1$s.laps`
                      WHERE compound IS NOT NULL AND lap_duration IS NOT NULL
                      GROUP BY driver_number, session_key, compound
                    )
                    GROUP BY driver_number
                  ),
                  season_points AS (
                    SELECT year, driver_number, SUM(%2$s) AS season_points
                    FROM race_results GROUP BY year, driver_number
                  ),
                  championship AS (
                    SELECT driver_number, MIN(championship_pos) AS best_finish
                    FROM (
                      SELECT year, driver_number,
                             RANK() OVER (PARTITION BY year ORDER BY season_points DESC) AS championship_pos
                      FROM season_points
                    )
                    GROUP BY driver_number
                  ),
                  teams AS (
                    SELECT driver_number, STRING_AGG(DISTINCT team_name, '|' ORDER BY team_name) AS teams_list
                    FROM `%1$s.session_drivers` WHERE team_name IS NOT NULL GROUP BY driver_number
                  ),
                  every_driver AS (
                    SELECT driver_number FROM race_results
                    UNION DISTINCT
                    SELECT driver_number FROM `%1$s.drivers`
                  )
                  SELECT
                    d.driver_number,
                    p.avg_position,
                    p.position_stddev,
                    th.full_throttle_pct,
                    st.avg_stint_length,
                    r.total_races,
                    r.wins,
                    r.podiums,
                    r.total_points,
                    c.best_finish,
                    tm.teams_list,
                    CURRENT_TIMESTAMP() AS computed_at
                  FROM every_driver d
                  LEFT JOIN positions p    ON p.driver_number  = d.driver_number
                  LEFT JOIN races r        ON r.driver_number  = d.driver_number
                  LEFT JOIN throttle th    ON th.driver_number = d.driver_number
                  LEFT JOIN stints st      ON st.driver_number = d.driver_number
                  LEFT JOIN championship c ON c.driver_number  = d.driver_number
                  LEFT JOIN teams tm       ON tm.driver_number = d.driver_number
                ) S
                ON T.driver_number = S.driver_number
                WHEN MATCHED THEN UPDATE SET
                  avg_position = S.avg_position,
                  position_stddev = S.position_stddev,
                  full_throttle_pct = S.full_throttle_pct,
                  avg_stint_length = S.avg_stint_length,
                  total_races = S.total_races,
                  wins = S.wins,
                  podiums = S.podiums,
                  total_points = S.total_points,
                  best_finish = S.best_finish,
                  teams_list = S.teams_list,
                  computed_at = S.computed_at
                WHEN NOT MATCHED THEN INSERT ROW
                """,
                        dataset(), POINTS_CASE, window.from(), window.to());

        try {
            queryRunner.query(sql);
            log.info(
                    "driver stats recomputed telemetry_window=[{} -> {}]",
                    window.from(),
                    window.to());
        } catch (Exception e) {
            throw new IllegalStateException("Driver stats recompute failed", e);
        }
    }

    private record TelemetryWindow(String from, String to) {}

    /**
     * The date range covered by every loaded session, used as the partition filter the telemetry
     * table now requires (P2). Read from the small unpartitioned {@code sessions} table rather than
     * from telemetry itself.
     */
    private TelemetryWindow telemetryWindow() {
        String sql =
                String.format(
                        """
                SELECT
                  FORMAT_TIMESTAMP('%%Y-%%m-%%d %%H:%%M:%%S', TIMESTAMP_SUB(MIN(date_start), INTERVAL 1 DAY)) AS win_from,
                  FORMAT_TIMESTAMP('%%Y-%%m-%%d %%H:%%M:%%S',
                    TIMESTAMP_ADD(COALESCE(MAX(date_end), MAX(date_start)), INTERVAL 1 DAY)) AS win_to
                FROM `%s.sessions`
                WHERE date_start IS NOT NULL
                """,
                        dataset());
        try {
            TableResult result = queryRunner.query(sql);
            for (FieldValueList row : result.iterateAll()) {
                if (row.get("win_from").isNull() || row.get("win_to").isNull()) {
                    return null;
                }
                return new TelemetryWindow(
                        row.get("win_from").getStringValue(), row.get("win_to").getStringValue());
            }
        } catch (Exception e) {
            log.error("telemetry window query failed", e);
        }
        return null;
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
