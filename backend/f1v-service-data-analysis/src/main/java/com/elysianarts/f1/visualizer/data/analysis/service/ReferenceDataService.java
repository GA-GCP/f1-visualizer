package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.model.SessionDriverEntry;
import com.elysianarts.f1.visualizer.data.analysis.repository.ReferenceDataCacheRepository;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final BigQuery bigQuery;
    private final ReferenceDataCacheRepository cacheRepository;
    private static final String DATASET = "f1_dataset";

    /**
     * On service startup, asynchronously warm the Firestore cache from
     * BigQuery so that the first user request is served instantly.
     */
    @PostConstruct
    public void warmCache() {
        new Thread(() -> {
            try {
                log.info("Warming Firestore reference-data cache from BigQuery...");

                List<DriverProfile> drivers = queryDriversFromBigQuery();
                if (!drivers.isEmpty()) {
                    cacheRepository.cacheDrivers(drivers);
                }

                List<RaceSession> sessions = querySessionsFromBigQuery("");
                if (!sessions.isEmpty()) {
                    cacheRepository.cacheSessions(sessions);
                }

                log.info("Firestore cache warm-up complete ({} drivers, {} sessions)",
                        drivers.size(), sessions.size());
            } catch (Exception e) {
                log.error("Cache warm-up failed (will fall back to BigQuery on requests)", e);
            }
        }, "cache-warmup").start();
    }

    // ── Public API (Firestore-first, BigQuery fallback) ──

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
            return List.of();
        }
    }

    private RaceEntryRoster querySessionDriversFromBigQuery(long sessionKey) {
        String sql = String.format("""
            SELECT session_key, year, driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
            FROM `%s.session_drivers`
            WHERE session_key = @sessionKey
            ORDER BY driver_number ASC
            """, DATASET);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(sql)
                    .addNamedParameter("sessionKey", com.google.cloud.bigquery.QueryParameterValue.int64(sessionKey))
                    .build();

            TableResult result = bigQuery.query(queryConfig);
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
        String sql = String.format("""
            SELECT driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
            FROM `%s.drivers`
            GROUP BY driver_number, broadcast_name, name_acronym, team_name, team_colour, country_code
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

                String acronym = row.get("name_acronym").isNull() ? null : row.get("name_acronym").getStringValue();
                String code = acronym != null ? acronym : (name.length() >= 3 ? name.substring(0, 3).toUpperCase() : String.valueOf(driverNum));

                drivers.add(DriverProfile.builder()
                        .id(driverNum)
                        .code(code)
                        .name(name)
                        .team(row.get("team_name").isNull() ? "Unknown" : row.get("team_name").getStringValue())
                        .teamColor("#" + teamColor)
                        .stats(DriverProfile.DriverStats.builder()
                                .speed(50).consistency(50).aggression(50).tireMgmt(50).experience(30)
                                .wins(0).podiums(0).totalPoints(0).bestChampionshipFinish(0).totalRaces(0)
                                .teamsDrivenFor(List.of()).build())
                        .build());
            }
            return drivers;
        } catch (Exception e) {
            log.error("Failed to fetch drivers from BigQuery", e);
            return List.of();
        }
    }
}
