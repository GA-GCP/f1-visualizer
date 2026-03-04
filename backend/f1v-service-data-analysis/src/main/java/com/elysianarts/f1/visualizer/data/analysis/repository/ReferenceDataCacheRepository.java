package com.elysianarts.f1.visualizer.data.analysis.repository;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
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
                    .limit(50)
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
}
