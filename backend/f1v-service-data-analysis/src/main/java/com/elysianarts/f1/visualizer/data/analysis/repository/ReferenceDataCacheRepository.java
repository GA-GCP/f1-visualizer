package com.elysianarts.f1.visualizer.data.analysis.repository;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.model.SessionDriverEntry;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteBatch;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ReferenceDataCacheRepository {

    private final Firestore firestore;

    private static final String DRIVERS_COLLECTION = "reference_drivers";
    private static final String SESSIONS_COLLECTION = "reference_sessions";
    private static final String RACE_ENTRIES_COLLECTION = "reference_race_entries";
    private static final String META_COLLECTION = "reference_meta";
    private static final String LAST_REFRESHED_DOCUMENT = "lastRefreshed";

    /** Firestore's hard limit is 500 writes per batch; the catalog grows past that. */
    private static final int BATCH_LIMIT = 400;

    /**
     * R8: how recent a refresh has to be for a starting instance to leave the cache alone. Every
     * deploy and every scale-out used to rewrite the entire catalog, with concurrent instances
     * racing each other to do it.
     */
    private static final Duration FRESH_FOR = Duration.ofHours(6);

    public boolean isCacheFresh() {
        try {
            DocumentSnapshot document =
                    firestore
                            .collection(META_COLLECTION)
                            .document(LAST_REFRESHED_DOCUMENT)
                            .get()
                            .get();
            if (!document.exists() || document.getString("at") == null) {
                return false;
            }
            Instant at = Instant.parse(document.getString("at"));
            return at.isAfter(Instant.now().minus(FRESH_FOR));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            log.warn("reference freshness check failed — warming anyway", e);
            return false;
        }
    }

    public void markRefreshed() {
        try {
            firestore
                    .collection(META_COLLECTION)
                    .document(LAST_REFRESHED_DOCUMENT)
                    .set(Map.of("at", Instant.now().toString()))
                    .get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException e) {
            log.warn("reference refresh marker not written", e);
        }
    }

    /**
     * Commits writes in chunks. A single {@code WriteBatch} that grows with the catalog eventually
     * exceeds Firestore's 500-write limit and fails the whole warm-up (R8).
     */
    private <T> void commitInChunks(
            List<T> items,
            String collection,
            java.util.function.Function<T, String> id,
            java.util.function.Function<T, Map<String, Object>> toMap)
            throws InterruptedException, ExecutionException {
        for (int start = 0; start < items.size(); start += BATCH_LIMIT) {
            List<T> chunk = items.subList(start, Math.min(items.size(), start + BATCH_LIMIT));
            WriteBatch batch = firestore.batch();
            for (T item : chunk) {
                batch.set(
                        firestore.collection(collection).document(id.apply(item)),
                        toMap.apply(item));
            }
            batch.commit().get();
        }
    }

    // ── Drivers ──

    public List<DriverProfile> getCachedDrivers() {
        try {
            QuerySnapshot snapshot =
                    firestore.collection(DRIVERS_COLLECTION).orderBy("id").get().get();

            List<DriverProfile> drivers = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                drivers.add(docToDriver(doc));
            }
            return drivers;
        } catch (InterruptedException | ExecutionException e) {
            log.warn("Failed to read drivers from Firestore cache", e);
            return List.of();
        }
    }

    public void cacheDrivers(List<DriverProfile> drivers) {
        try {
            commitInChunks(
                    drivers, DRIVERS_COLLECTION, d -> String.valueOf(d.getId()), this::driverToMap);
            log.info("reference drivers cached count={}", drivers.size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache drivers in Firestore", e);
        }
    }

    // ── Sessions ──

    public List<RaceSession> getCachedSessions() {
        try {
            QuerySnapshot snapshot =
                    firestore
                            .collection(SESSIONS_COLLECTION)
                            .orderBy("year", com.google.cloud.firestore.Query.Direction.DESCENDING)
                            .orderBy(
                                    "sessionKey",
                                    com.google.cloud.firestore.Query.Direction.DESCENDING)
                            .get()
                            .get();

            List<RaceSession> sessions = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                sessions.add(docToSession(doc));
            }
            return sessions;
        } catch (InterruptedException | ExecutionException e) {
            log.warn("Failed to read sessions from Firestore cache", e);
            return List.of();
        }
    }

    public void cacheSessions(List<RaceSession> sessions) {
        try {
            commitInChunks(
                    sessions,
                    SESSIONS_COLLECTION,
                    s -> String.valueOf(s.getSessionKey()),
                    this::sessionToMap);
            log.info("reference sessions cached count={}", sessions.size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache sessions in Firestore", e);
        }
    }

    // ── Race Entries ──

    public RaceEntryRoster getCachedRaceEntries(long sessionKey) {
        try {
            DocumentSnapshot doc =
                    firestore
                            .collection(RACE_ENTRIES_COLLECTION)
                            .document(String.valueOf(sessionKey))
                            .get()
                            .get();

            if (!doc.exists()) return null;
            return docToRaceEntryRoster(doc);
        } catch (InterruptedException | ExecutionException e) {
            log.warn(
                    "Failed to read race entries for session {} from Firestore cache",
                    sessionKey,
                    e);
            return null;
        }
    }

    public List<RaceEntryRoster> getCachedRaceEntriesByYear(int year) {
        try {
            QuerySnapshot snapshot =
                    firestore
                            .collection(RACE_ENTRIES_COLLECTION)
                            .whereEqualTo("year", year)
                            .orderBy(
                                    "sessionKey",
                                    com.google.cloud.firestore.Query.Direction.DESCENDING)
                            .get()
                            .get();

            List<RaceEntryRoster> rosters = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                rosters.add(docToRaceEntryRoster(doc));
            }
            return rosters;
        } catch (InterruptedException | ExecutionException e) {
            log.warn("Failed to read race entries for year {} from Firestore cache", year, e);
            return List.of();
        }
    }

    public void cacheRaceEntries(RaceEntryRoster roster) {
        try {
            firestore
                    .collection(RACE_ENTRIES_COLLECTION)
                    .document(String.valueOf(roster.getSessionKey()))
                    .set(raceEntryRosterToMap(roster))
                    .get();
            log.info(
                    "Cached race entries for session {} ({} drivers)",
                    roster.getSessionKey(),
                    roster.getDrivers().size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache race entries for session {}", roster.getSessionKey(), e);
        }
    }

    public void cacheRaceEntriesBatch(List<RaceEntryRoster> rosters) {
        try {
            commitInChunks(
                    rosters,
                    RACE_ENTRIES_COLLECTION,
                    r -> String.valueOf(r.getSessionKey()),
                    this::raceEntryRosterToMap);
            log.info("reference rosters cached count={}", rosters.size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to batch cache race entries in Firestore", e);
        }
    }

    // ── Converters ──

    private Map<String, Object> driverToMap(DriverProfile driver) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", driver.getId());
        map.put("code", driver.getCode());
        map.put("name", driver.getName());
        map.put("team", driver.getTeam());
        map.put("teamColor", driver.getTeamColor());
        // Stats are stored as a nested map
        Map<String, Object> stats = new HashMap<>();
        stats.put("speed", driver.getStats().getSpeed());
        stats.put("consistency", driver.getStats().getConsistency());
        stats.put("aggression", driver.getStats().getAggression());
        stats.put("tireMgmt", driver.getStats().getTireMgmt());
        stats.put("experience", driver.getStats().getExperience());
        stats.put("wins", driver.getStats().getWins());
        stats.put("podiums", driver.getStats().getPodiums());
        stats.put("totalPoints", driver.getStats().getTotalPoints());
        stats.put("bestChampionshipFinish", driver.getStats().getBestChampionshipFinish());
        stats.put("totalRaces", driver.getStats().getTotalRaces());
        stats.put("teamsDrivenFor", driver.getStats().getTeamsDrivenFor());
        map.put("stats", stats);
        return map;
    }

    @SuppressWarnings("unchecked")
    private DriverProfile docToDriver(DocumentSnapshot doc) {
        Map<String, Object> statsMap = (Map<String, Object>) doc.get("stats");
        DriverProfile.DriverStats.DriverStatsBuilder statsBuilder =
                DriverProfile.DriverStats.builder()
                        .speed(((Number) statsMap.get("speed")).intValue())
                        .consistency(((Number) statsMap.get("consistency")).intValue())
                        .aggression(((Number) statsMap.get("aggression")).intValue())
                        .tireMgmt(((Number) statsMap.get("tireMgmt")).intValue())
                        .experience(((Number) statsMap.get("experience")).intValue())
                        .wins(((Number) statsMap.get("wins")).intValue())
                        .podiums(((Number) statsMap.get("podiums")).intValue());

        // Gracefully handle documents cached before these fields existed
        if (statsMap.containsKey("totalPoints")) {
            statsBuilder.totalPoints(((Number) statsMap.get("totalPoints")).intValue());
        }
        if (statsMap.containsKey("bestChampionshipFinish")) {
            statsBuilder.bestChampionshipFinish(
                    ((Number) statsMap.get("bestChampionshipFinish")).intValue());
        }
        if (statsMap.containsKey("totalRaces")) {
            statsBuilder.totalRaces(((Number) statsMap.get("totalRaces")).intValue());
        }
        if (statsMap.containsKey("teamsDrivenFor")
                && statsMap.get("teamsDrivenFor") instanceof List<?> teams) {
            statsBuilder.teamsDrivenFor(teams.stream().map(Object::toString).toList());
        }

        return DriverProfile.builder()
                .id(doc.getLong("id").intValue())
                .code(doc.getString("code"))
                .name(doc.getString("name"))
                .team(doc.getString("team"))
                .teamColor(doc.getString("teamColor"))
                .stats(statsBuilder.build())
                .build();
    }

    private Map<String, Object> sessionToMap(RaceSession session) {
        Map<String, Object> map = new HashMap<>();
        map.put("sessionKey", session.getSessionKey());
        map.put("sessionName", session.getSessionName());
        map.put("meetingName", session.getMeetingName());
        map.put("year", session.getYear());
        map.put("countryName", session.getCountryName());
        return map;
    }

    private RaceSession docToSession(DocumentSnapshot doc) {
        return RaceSession.builder()
                .sessionKey(doc.getLong("sessionKey"))
                .sessionName(doc.getString("sessionName"))
                .meetingName(doc.getString("meetingName"))
                .year(doc.getLong("year").intValue())
                .countryName(doc.getString("countryName"))
                .build();
    }

    private Map<String, Object> raceEntryRosterToMap(RaceEntryRoster roster) {
        Map<String, Object> map = new HashMap<>();
        map.put("sessionKey", roster.getSessionKey());
        map.put("year", roster.getYear());

        List<Map<String, Object>> driverMaps = new ArrayList<>();
        for (SessionDriverEntry entry : roster.getDrivers()) {
            Map<String, Object> driverMap = new HashMap<>();
            driverMap.put("driverNumber", entry.getDriverNumber());
            driverMap.put("broadcastName", entry.getBroadcastName());
            driverMap.put("nameAcronym", entry.getNameAcronym());
            driverMap.put("teamName", entry.getTeamName());
            driverMap.put("teamColour", entry.getTeamColour());
            driverMap.put("countryCode", entry.getCountryCode());
            driverMaps.add(driverMap);
        }
        map.put("drivers", driverMaps);
        return map;
    }

    @SuppressWarnings("unchecked")
    private RaceEntryRoster docToRaceEntryRoster(DocumentSnapshot doc) {
        List<Map<String, Object>> driverMaps = (List<Map<String, Object>>) doc.get("drivers");
        List<SessionDriverEntry> drivers = new ArrayList<>();

        if (driverMaps != null) {
            for (Map<String, Object> dm : driverMaps) {
                drivers.add(
                        SessionDriverEntry.builder()
                                .driverNumber(((Number) dm.get("driverNumber")).intValue())
                                .broadcastName((String) dm.get("broadcastName"))
                                .nameAcronym((String) dm.get("nameAcronym"))
                                .teamName((String) dm.get("teamName"))
                                .teamColour((String) dm.get("teamColour"))
                                .countryCode((String) dm.get("countryCode"))
                                .build());
            }
        }

        return RaceEntryRoster.builder()
                .sessionKey(doc.getLong("sessionKey"))
                .year(doc.getLong("year").intValue())
                .drivers(drivers)
                .build();
    }
}
