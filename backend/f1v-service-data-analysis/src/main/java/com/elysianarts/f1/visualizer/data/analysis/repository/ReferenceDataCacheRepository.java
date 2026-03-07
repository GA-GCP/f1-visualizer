package com.elysianarts.f1.visualizer.data.analysis.repository;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.model.SessionDriverEntry;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteBatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ReferenceDataCacheRepository {

    private final Firestore firestore;

    private static final String DRIVERS_COLLECTION = "reference_drivers";
    private static final String SESSIONS_COLLECTION = "reference_sessions";
    private static final String RACE_ENTRIES_COLLECTION = "reference_race_entries";

    // ── Drivers ──

    public List<DriverProfile> getCachedDrivers() {
        try {
            QuerySnapshot snapshot = firestore.collection(DRIVERS_COLLECTION)
                    .orderBy("id")
                    .get().get();

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
            WriteBatch batch = firestore.batch();
            for (DriverProfile driver : drivers) {
                batch.set(
                        firestore.collection(DRIVERS_COLLECTION).document(String.valueOf(driver.getId())),
                        driverToMap(driver)
                );
            }
            batch.commit().get();
            log.info("Cached {} drivers in Firestore", drivers.size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache drivers in Firestore", e);
        }
    }

    // ── Sessions ──

    public List<RaceSession> getCachedSessions() {
        try {
            QuerySnapshot snapshot = firestore.collection(SESSIONS_COLLECTION)
                    .orderBy("year", com.google.cloud.firestore.Query.Direction.DESCENDING)
                    .orderBy("sessionKey", com.google.cloud.firestore.Query.Direction.DESCENDING)
                    .get().get();

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
            WriteBatch batch = firestore.batch();
            for (RaceSession session : sessions) {
                batch.set(
                        firestore.collection(SESSIONS_COLLECTION).document(String.valueOf(session.getSessionKey())),
                        sessionToMap(session)
                );
            }
            batch.commit().get();
            log.info("Cached {} sessions in Firestore", sessions.size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache sessions in Firestore", e);
        }
    }

    // ── Race Entries ──

    public RaceEntryRoster getCachedRaceEntries(long sessionKey) {
        try {
            DocumentSnapshot doc = firestore.collection(RACE_ENTRIES_COLLECTION)
                    .document(String.valueOf(sessionKey))
                    .get().get();

            if (!doc.exists()) return null;
            return docToRaceEntryRoster(doc);
        } catch (InterruptedException | ExecutionException e) {
            log.warn("Failed to read race entries for session {} from Firestore cache", sessionKey, e);
            return null;
        }
    }

    public List<RaceEntryRoster> getCachedRaceEntriesByYear(int year) {
        try {
            QuerySnapshot snapshot = firestore.collection(RACE_ENTRIES_COLLECTION)
                    .whereEqualTo("year", year)
                    .orderBy("sessionKey", com.google.cloud.firestore.Query.Direction.DESCENDING)
                    .get().get();

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
            firestore.collection(RACE_ENTRIES_COLLECTION)
                    .document(String.valueOf(roster.getSessionKey()))
                    .set(raceEntryRosterToMap(roster))
                    .get();
            log.info("Cached race entries for session {} ({} drivers)", roster.getSessionKey(), roster.getDrivers().size());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to cache race entries for session {}", roster.getSessionKey(), e);
        }
    }

    public void cacheRaceEntriesBatch(List<RaceEntryRoster> rosters) {
        try {
            WriteBatch batch = firestore.batch();
            for (RaceEntryRoster roster : rosters) {
                batch.set(
                        firestore.collection(RACE_ENTRIES_COLLECTION).document(String.valueOf(roster.getSessionKey())),
                        raceEntryRosterToMap(roster)
                );
            }
            batch.commit().get();
            log.info("Cached {} race entry rosters in Firestore", rosters.size());
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
        map.put("stats", stats);
        return map;
    }

    @SuppressWarnings("unchecked")
    private DriverProfile docToDriver(DocumentSnapshot doc) {
        Map<String, Object> statsMap = (Map<String, Object>) doc.get("stats");
        return DriverProfile.builder()
                .id(doc.getLong("id").intValue())
                .code(doc.getString("code"))
                .name(doc.getString("name"))
                .team(doc.getString("team"))
                .teamColor(doc.getString("teamColor"))
                .stats(DriverProfile.DriverStats.builder()
                        .speed(((Number) statsMap.get("speed")).intValue())
                        .consistency(((Number) statsMap.get("consistency")).intValue())
                        .aggression(((Number) statsMap.get("aggression")).intValue())
                        .tireMgmt(((Number) statsMap.get("tireMgmt")).intValue())
                        .experience(((Number) statsMap.get("experience")).intValue())
                        .wins(((Number) statsMap.get("wins")).intValue())
                        .podiums(((Number) statsMap.get("podiums")).intValue())
                        .build())
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
                drivers.add(SessionDriverEntry.builder()
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
