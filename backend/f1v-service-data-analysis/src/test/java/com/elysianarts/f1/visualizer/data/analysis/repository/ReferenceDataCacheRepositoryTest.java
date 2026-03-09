package com.elysianarts.f1.visualizer.data.analysis.repository;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.model.SessionDriverEntry;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReferenceDataCacheRepositoryTest {

    @Mock
    private Firestore firestore;

    @InjectMocks
    private ReferenceDataCacheRepository repository;

    // ── Helper builders ──

    private DriverProfile buildDriver(int id, String code, String name, String team) {
        return DriverProfile.builder()
                .id(id)
                .code(code)
                .name(name)
                .team(team)
                .teamColor("3671C6")
                .stats(DriverProfile.DriverStats.builder()
                        .speed(90).consistency(85).aggression(70)
                        .tireMgmt(80).experience(95)
                        .wins(60).podiums(110)
                        .totalPoints(2500).bestChampionshipFinish(1)
                        .totalRaces(200)
                        .teamsDrivenFor(List.of("Red Bull", "Toro Rosso"))
                        .build())
                .build();
    }

    private RaceSession buildSession(long key, String name, String meeting, int year) {
        return RaceSession.builder()
                .sessionKey(key)
                .sessionName(name)
                .meetingName(meeting)
                .year(year)
                .countryName("Bahrain")
                .build();
    }

    @SuppressWarnings("unchecked")
    private QueryDocumentSnapshot mockDriverDoc(DriverProfile driver) {
        QueryDocumentSnapshot doc = mock(QueryDocumentSnapshot.class);
        when(doc.getLong("id")).thenReturn((long) driver.getId());
        when(doc.getString("code")).thenReturn(driver.getCode());
        when(doc.getString("name")).thenReturn(driver.getName());
        when(doc.getString("team")).thenReturn(driver.getTeam());
        when(doc.getString("teamColor")).thenReturn(driver.getTeamColor());

        Map<String, Object> statsMap = Map.of(
                "speed", driver.getStats().getSpeed(),
                "consistency", driver.getStats().getConsistency(),
                "aggression", driver.getStats().getAggression(),
                "tireMgmt", driver.getStats().getTireMgmt(),
                "experience", driver.getStats().getExperience(),
                "wins", driver.getStats().getWins(),
                "podiums", driver.getStats().getPodiums(),
                "totalPoints", driver.getStats().getTotalPoints(),
                "bestChampionshipFinish", driver.getStats().getBestChampionshipFinish(),
                "totalRaces", driver.getStats().getTotalRaces()
        );
        when(doc.get("stats")).thenReturn(statsMap);
        return doc;
    }

    private QueryDocumentSnapshot mockSessionDoc(RaceSession session) {
        QueryDocumentSnapshot doc = mock(QueryDocumentSnapshot.class);
        when(doc.getLong("sessionKey")).thenReturn(session.getSessionKey());
        when(doc.getString("sessionName")).thenReturn(session.getSessionName());
        when(doc.getString("meetingName")).thenReturn(session.getMeetingName());
        when(doc.getLong("year")).thenReturn((long) session.getYear());
        when(doc.getString("countryName")).thenReturn(session.getCountryName());
        return doc;
    }

    /** For collections using a simple orderBy(field) — e.g. drivers ordered by "id". */
    @SuppressWarnings("unchecked")
    private void mockSimpleOrderByQuery(String collection, String field, List<QueryDocumentSnapshot> docs) throws Exception {
        CollectionReference collRef = mock(CollectionReference.class);
        Query query = mock(Query.class);
        ApiFuture<QuerySnapshot> future = mock(ApiFuture.class);
        QuerySnapshot snapshot = mock(QuerySnapshot.class);

        when(firestore.collection(collection)).thenReturn(collRef);
        when(collRef.orderBy(field)).thenReturn(query);
        when(query.get()).thenReturn(future);
        when(future.get()).thenReturn(snapshot);
        when(snapshot.getDocuments()).thenReturn(docs);
    }

    /** For collections using two orderBy(field, direction) — e.g. sessions ordered by year DESC, sessionKey DESC. */
    @SuppressWarnings("unchecked")
    private void mockDoubleOrderByQuery(String collection, List<QueryDocumentSnapshot> docs) throws Exception {
        CollectionReference collRef = mock(CollectionReference.class);
        Query query = mock(Query.class);
        Query query2 = mock(Query.class);
        ApiFuture<QuerySnapshot> future = mock(ApiFuture.class);
        QuerySnapshot snapshot = mock(QuerySnapshot.class);

        when(firestore.collection(collection)).thenReturn(collRef);
        when(collRef.orderBy(anyString(), any(Query.Direction.class))).thenReturn(query);
        when(query.orderBy(anyString(), any(Query.Direction.class))).thenReturn(query2);
        when(query2.get()).thenReturn(future);
        when(future.get()).thenReturn(snapshot);
        when(snapshot.getDocuments()).thenReturn(docs);
    }

    // ── getCachedDrivers ──

    @Test
    void getCachedDrivers_ReturnsMappedDrivers_WhenDataExists() throws Exception {
        DriverProfile driver = buildDriver(1, "VER", "Max Verstappen", "Red Bull");
        QueryDocumentSnapshot doc = mockDriverDoc(driver);
        mockSimpleOrderByQuery("reference_drivers", "id", List.of(doc));

        List<DriverProfile> result = repository.getCachedDrivers();

        assertEquals(1, result.size());
        assertEquals("VER", result.get(0).getCode());
        assertEquals("Max Verstappen", result.get(0).getName());
        assertEquals(90, result.get(0).getStats().getSpeed());
    }

    @Test
    void getCachedDrivers_ReturnsEmptyList_WhenFirestoreFails() throws Exception {
        CollectionReference collRef = mock(CollectionReference.class);
        Query query = mock(Query.class);
        @SuppressWarnings("unchecked")
        ApiFuture<QuerySnapshot> future = mock(ApiFuture.class);

        when(firestore.collection("reference_drivers")).thenReturn(collRef);
        when(collRef.orderBy("id")).thenReturn(query);
        when(query.get()).thenReturn(future);
        when(future.get()).thenThrow(new ExecutionException("Firestore unavailable", new RuntimeException()));

        List<DriverProfile> result = repository.getCachedDrivers();

        assertTrue(result.isEmpty());
    }

    // ── cacheDrivers ──

    @SuppressWarnings("unchecked")
    @Test
    void cacheDrivers_CommitsBatch_ForEachDriver() throws Exception {
        DriverProfile driver = buildDriver(1, "VER", "Max Verstappen", "Red Bull");

        WriteBatch batch = mock(WriteBatch.class);
        when(firestore.batch()).thenReturn(batch);

        CollectionReference collRef = mock(CollectionReference.class);
        DocumentReference docRef = mock(DocumentReference.class);
        when(firestore.collection("reference_drivers")).thenReturn(collRef);
        when(collRef.document("1")).thenReturn(docRef);
        when(batch.set(eq(docRef), anyMap())).thenReturn(batch);

        ApiFuture<List<WriteResult>> commitFuture = mock(ApiFuture.class);
        when(batch.commit()).thenReturn(commitFuture);
        when(commitFuture.get()).thenReturn(List.of());

        repository.cacheDrivers(List.of(driver));

        verify(batch).set(eq(docRef), anyMap());
        verify(batch).commit();
    }

    // ── getCachedSessions ──

    @Test
    void getCachedSessions_ReturnsMappedSessions_WhenDataExists() throws Exception {
        RaceSession session = buildSession(9165, "Race", "Bahrain GP", 2024);
        QueryDocumentSnapshot doc = mockSessionDoc(session);
        mockDoubleOrderByQuery("reference_sessions", List.of(doc));

        List<RaceSession> result = repository.getCachedSessions();

        assertEquals(1, result.size());
        assertEquals(9165, result.get(0).getSessionKey());
        assertEquals("Race", result.get(0).getSessionName());
    }

    @Test
    void getCachedSessions_ReturnsEmptyList_WhenFirestoreFails() throws Exception {
        CollectionReference collRef = mock(CollectionReference.class);
        Query query = mock(Query.class);
        Query query2 = mock(Query.class);
        @SuppressWarnings("unchecked")
        ApiFuture<QuerySnapshot> future = mock(ApiFuture.class);

        when(firestore.collection("reference_sessions")).thenReturn(collRef);
        when(collRef.orderBy("year", Query.Direction.DESCENDING)).thenReturn(query);
        when(query.orderBy("sessionKey", Query.Direction.DESCENDING)).thenReturn(query2);
        when(query2.get()).thenReturn(future);
        when(future.get()).thenThrow(new ExecutionException("Firestore unavailable", new RuntimeException()));

        List<RaceSession> result = repository.getCachedSessions();

        assertTrue(result.isEmpty());
    }

    // ── getCachedRaceEntries ──

    @SuppressWarnings("unchecked")
    @Test
    void getCachedRaceEntries_ReturnsRoster_WhenDocExists() throws Exception {
        DocumentSnapshot doc = mock(DocumentSnapshot.class);
        when(doc.exists()).thenReturn(true);
        when(doc.getLong("sessionKey")).thenReturn(9165L);
        when(doc.getLong("year")).thenReturn(2024L);

        List<Map<String, Object>> driverMaps = List.of(
                Map.of(
                        "driverNumber", 1,
                        "broadcastName", "M VERSTAPPEN",
                        "nameAcronym", "VER",
                        "teamName", "Red Bull Racing",
                        "teamColour", "3671C6",
                        "countryCode", "NED"
                )
        );
        when(doc.get("drivers")).thenReturn(driverMaps);

        CollectionReference collRef = mock(CollectionReference.class);
        DocumentReference docRef = mock(DocumentReference.class);
        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);

        when(firestore.collection("reference_race_entries")).thenReturn(collRef);
        when(collRef.document("9165")).thenReturn(docRef);
        when(docRef.get()).thenReturn(future);
        when(future.get()).thenReturn(doc);

        RaceEntryRoster result = repository.getCachedRaceEntries(9165);

        assertNotNull(result);
        assertEquals(9165, result.getSessionKey());
        assertEquals(2024, result.getYear());
        assertEquals(1, result.getDrivers().size());
        assertEquals("VER", result.getDrivers().get(0).getNameAcronym());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getCachedRaceEntries_ReturnsNull_WhenDocDoesNotExist() throws Exception {
        DocumentSnapshot doc = mock(DocumentSnapshot.class);
        when(doc.exists()).thenReturn(false);

        CollectionReference collRef = mock(CollectionReference.class);
        DocumentReference docRef = mock(DocumentReference.class);
        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);

        when(firestore.collection("reference_race_entries")).thenReturn(collRef);
        when(collRef.document("9999")).thenReturn(docRef);
        when(docRef.get()).thenReturn(future);
        when(future.get()).thenReturn(doc);

        RaceEntryRoster result = repository.getCachedRaceEntries(9999);

        assertNull(result);
    }

    @SuppressWarnings("unchecked")
    @Test
    void getCachedRaceEntries_ReturnsNull_WhenFirestoreFails() throws Exception {
        CollectionReference collRef = mock(CollectionReference.class);
        DocumentReference docRef = mock(DocumentReference.class);
        ApiFuture<DocumentSnapshot> future = mock(ApiFuture.class);

        when(firestore.collection("reference_race_entries")).thenReturn(collRef);
        when(collRef.document("9165")).thenReturn(docRef);
        when(docRef.get()).thenReturn(future);
        when(future.get()).thenThrow(new ExecutionException("Firestore error", new RuntimeException()));

        RaceEntryRoster result = repository.getCachedRaceEntries(9165);

        assertNull(result);
    }
}
