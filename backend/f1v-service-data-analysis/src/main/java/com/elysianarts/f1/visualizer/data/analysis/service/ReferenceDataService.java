package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.model.SessionDriverEntry;
import com.elysianarts.f1.visualizer.data.analysis.repository.ReferenceDataCacheRepository;
import com.elysianarts.f1.visualizer.commons.gcp.bq.BigQueryQueryRunner;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import com.elysianarts.f1.visualizer.data.analysis.config.CacheConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final BigQueryQueryRunner queryRunner;
    private final ReferenceDataCacheRepository cacheRepository;
    private final TaskExecutor taskExecutor;

    /**
     * Warms the Firestore cache from BigQuery after startup (R8).
     *
     * <p>This used to start a raw {@code new Thread} from {@code @PostConstruct}
     * and unconditionally rewrite every driver and session document — on every
     * deploy and every scale-out, with concurrent instances racing each other, on
     * a thread invisible to Spring's lifecycle and metrics. It now runs on the
     * managed executor after the context is ready, and skips entirely when another
     * instance has already refreshed recently.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void warmCache() {
        taskExecutor.execute(() -> {
            try {
                if (cacheRepository.isCacheFresh()) {
                    log.info("reference cache warm-up skipped reason=already_fresh");
                    return;
                }
                log.info("reference cache warm-up starting");

                List<DriverProfile> drivers = queryDriversFromBigQuery();
                if (!drivers.isEmpty()) {
                    cacheRepository.cacheDrivers(drivers);
                }

                List<RaceSession> sessions = querySessionsFromBigQuery("");
                if (!sessions.isEmpty()) {
                    cacheRepository.cacheSessions(sessions);
                }

                cacheRepository.markRefreshed();
                log.info("reference cache warm-up complete drivers={} sessions={}", drivers.size(), sessions.size());
            } catch (Exception e) {
                log.error("reference cache warm-up failed — requests will fall back to BigQuery", e);
            }
        });
    }

    // ── Public API (Firestore-first, BigQuery fallback) ──

    @Cacheable(CacheConfig.DRIVERS)
    public List<DriverProfile> getMasterDriverList() {
        // Try the fast Firestore cache first
        List<DriverProfile> cached = cacheRepository.getCachedDrivers();
        if (!cached.isEmpty()) {
            return cached;
        }

        // Cache miss — query BigQuery and populate cache for next time
        log.info("Firestore cache miss for drivers, querying BigQuery");
        List<DriverProfile> drivers = queryDriversFromBigQuery();
        if (!drivers.isEmpty()) {
            cacheRepository.cacheDrivers(drivers);
        }
        return drivers;
    }

    @Cacheable(CacheConfig.SESSIONS)
    public List<RaceSession> getAvailableSessions() {
        // Try the fast Firestore cache first
        List<RaceSession> cached = cacheRepository.getCachedSessions();
        if (!cached.isEmpty()) {
            return cached;
        }

        // Cache miss — query BigQuery and populate cache
        log.info("Firestore cache miss for sessions, querying BigQuery");
        List<RaceSession> sessions = querySessionsFromBigQuery("");
        if (!sessions.isEmpty()) {
            cacheRepository.cacheSessions(sessions);
        }
        return sessions;
    }

    public List<RaceSession> searchSessions(String query) {
        // All searches are served from the Firestore cache and filtered in-memory.
        // This avoids slow BigQuery round-trips on every keystroke.
        List<RaceSession> all = getAvailableSessions();
        if (query == null || query.isBlank()) {
            return all;
        }
        String lower = query.toLowerCase();
        return all.stream()
                .filter(s -> s.getMeetingName().toLowerCase().contains(lower)
                        || s.getCountryName().toLowerCase().contains(lower)
                        || String.valueOf(s.getYear()).contains(lower)
                        || s.getSessionName().toLowerCase().contains(lower))
                .toList();
    }

    /**
     * Returns the exact driver roster for a specific race session, including
     * each driver's team and team color at the time of that race.
     * Firestore-first, BigQuery fallback.
     */
    @Cacheable(cacheNames = CacheConfig.SESSION_DRIVERS, key = "#sessionKey")
    public RaceEntryRoster getDriversForSession(long sessionKey) {
        // Try Firestore cache first
        RaceEntryRoster cached = cacheRepository.getCachedRaceEntries(sessionKey);
        if (cached != null) {
            return cached;
        }

        // Cache miss — query BigQuery and populate cache
        log.info("Firestore cache miss for session drivers (session={}), querying BigQuery", sessionKey);
        RaceEntryRoster roster = querySessionDriversFromBigQuery(sessionKey);
        if (roster != null && !roster.getDrivers().isEmpty()) {
            cacheRepository.cacheRaceEntries(roster);
        }
        return roster;
    }

    /**
     * Returns the distinct years available in the sessions data,
     * sorted descending (newest first).
     */
    public List<Integer> getAvailableYears() {
        List<RaceSession> allSessions = getAvailableSessions();
        return allSessions.stream()
                .map(RaceSession::getYear)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());
    }

    /**
     * Every session in a year, of any type. P5: lets {@code /sessions?year=} return
     * one season instead of the whole catalog.
     */
    public List<RaceSession> getSessionsForYear(int year) {
        return getAvailableSessions().stream()
                .filter(s -> s.getYear() == year)
                .sorted(Comparator.comparingLong(RaceSession::getSessionKey).reversed())
                .collect(Collectors.toList());
    }

    /**
     * Returns all Race sessions for a specific year, sorted by session key descending.
     */
    public List<RaceSession> getSessionsByYear(int year) {
        List<RaceSession> allSessions = getAvailableSessions();
        return allSessions.stream()
                .filter(s -> s.getYear() == year)
                .filter(s -> "Race".equalsIgnoreCase(s.getSessionName()))
                .sorted(Comparator.comparingLong(RaceSession::getSessionKey).reversed())
                .collect(Collectors.toList());
    }

    // ── BigQuery Queries (source-of-truth) ──

    private List<RaceSession> querySessionsFromBigQuery(String query) {
        String sql = String.format("""
            SELECT session_key, session_name, meeting_name, year, country_name
            FROM `%s.sessions`
            WHERE LOWER(meeting_name) LIKE LOWER(@search) OR LOWER(country_name) LIKE LOWER(@search)
            ORDER BY year DESC, meeting_key DESC, session_key DESC
            """, dataset());

        try {
            TableResult result = queryRunner.query(QueryJobConfiguration.newBuilder(sql)
                    .addNamedParameter("search", com.google.cloud.bigquery.QueryParameterValue.string("%" + query + "%")));
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
            return List.of();
        }
    }

    private RaceEntryRoster querySessionDriversFromBigQuery(long sessionKey) {
        String sql = String.format("""
            SELECT session_key, year, driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
            FROM `%s.session_drivers`
            WHERE session_key = @sessionKey
            ORDER BY driver_number ASC
            """, dataset());

        try {
            TableResult result = queryRunner.query(QueryJobConfiguration.newBuilder(sql)
                    .addNamedParameter("sessionKey", com.google.cloud.bigquery.QueryParameterValue.int64(sessionKey)));
            List<SessionDriverEntry> drivers = new ArrayList<>();
            int year = 0;

            for (FieldValueList row : result.iterateAll()) {
                if (year == 0) {
                    year = row.get("year").isNull() ? 2023 : (int) row.get("year").getLongValue();
                }
                drivers.add(SessionDriverEntry.builder()
                        .driverNumber((int) row.get("driver_number").getLongValue())
                        .broadcastName(row.get("broadcast_name").isNull() ? "Unknown" : row.get("broadcast_name").getStringValue())
                        .nameAcronym(row.get("name_acronym").isNull() ? null : row.get("name_acronym").getStringValue())
                        .teamName(row.get("team_name").isNull() ? "Unknown" : row.get("team_name").getStringValue())
                        .teamColour(row.get("team_colour").isNull() ? "ffffff" : row.get("team_colour").getStringValue())
                        .countryCode(row.get("country_code").isNull() ? "" : row.get("country_code").getStringValue())
                        .build());
            }

            return RaceEntryRoster.builder()
                    .sessionKey(sessionKey)
                    .year(year)
                    .drivers(drivers)
                    .build();
        } catch (Exception e) {
            log.error("Failed to fetch session drivers from BigQuery for session {}", sessionKey, e);
            return RaceEntryRoster.builder().sessionKey(sessionKey).year(0).drivers(List.of()).build();
        }
    }

    private List<DriverProfile> queryDriversFromBigQuery() {
        // C8: the list used to hand every driver the same 50/50/50/30 placeholder,
        // which was then written to Firestore as though it were data, while
        // /drivers/{id}/stats computed the real thing. Both now read the same
        // precomputed table (P2).
        String sql = String.format("""
            SELECT d.driver_number, d.broadcast_name, d.name_acronym, d.team_name, d.team_colour, d.country_code,
                   s.avg_position, s.position_stddev, s.full_throttle_pct, s.avg_stint_length,
                   s.total_races, s.wins, s.podiums, s.total_points, s.best_finish, s.teams_list
            FROM (
              SELECT driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
              FROM `%1$s.drivers`
              GROUP BY driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
            ) d
            LEFT JOIN `%1$s.driver_stats` s ON s.driver_number = d.driver_number
            ORDER BY d.driver_number ASC
            """, dataset());

        try {
            TableResult result = queryRunner.query(sql);
            List<DriverProfile> drivers = new ArrayList<>();

            for (FieldValueList row : result.iterateAll()) {
                int driverNum = (int) row.get("driver_number").getLongValue();
                String teamColor = row.get("team_colour").isNull() ? "ffffff" : row.get("team_colour").getStringValue();
                String name = row.get("broadcast_name").isNull() ? "Unknown" : row.get("broadcast_name").getStringValue();

                String acronym = row.get("name_acronym").isNull() ? null : row.get("name_acronym").getStringValue();
                String code = acronym != null ? acronym : (name.length() >= 3 ? name.substring(0, 3).toUpperCase() : String.valueOf(driverNum));

                drivers.add(DriverProfile.builder()
                        .id(driverNum)
                        .code(code)
                        .name(name)
                        .team(row.get("team_name").isNull() ? "Unknown" : row.get("team_name").getStringValue())
                        .teamColor("#" + teamColor)
                        .stats(RaceAnalysisService.toStats(row))
                        .build());
            }
            return drivers;
        } catch (Exception e) {
            log.error("Failed to fetch drivers from BigQuery", e);
            return List.of();
        }
    }

    /** C4: {@code "f1_dataset"} was a private constant in ten classes. */
    private String dataset() {
        return queryRunner.properties().dataset();
    }
}
