package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.service.ReferenceDataService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis")
public class ReferenceDataController {

    /**
     * P5: reference data changes a few times a season and carried no
     * {@code Cache-Control} at all, so every navigation re-fetched the whole
     * catalog. An hour is well inside how often it actually moves, and the
     * {@code ShallowEtagHeaderFilter} turns a repeat request into a 304.
     */
    private static final CacheControl REFERENCE_CACHE =
            CacheControl.maxAge(Duration.ofHours(1)).cachePublic();

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/drivers")
    public ResponseEntity<List<DriverProfile>> getDrivers() {
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE)
                .body(referenceDataService.getMasterDriverList());
    }

    /**
     * @param year optional filter. P5: the full catalog went out on every call
     *             even when the caller wanted one season, which is the only way
     *             the UI ever uses it.
     */
    @GetMapping("/sessions")
    public ResponseEntity<List<RaceSession>> getSessions(@RequestParam(required = false) Integer year) {
        List<RaceSession> sessions = (year == null)
                ? referenceDataService.getAvailableSessions()
                : referenceDataService.getSessionsForYear(year);
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE).body(sessions);
    }

    @GetMapping("/sessions/search")
    public ResponseEntity<List<RaceSession>> searchSessions(
            @RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE)
                .body(referenceDataService.searchSessions(query));
    }

    @GetMapping("/sessions/{sessionKey}/drivers")
    public ResponseEntity<RaceEntryRoster> getSessionDrivers(@PathVariable long sessionKey) {
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE)
                .body(referenceDataService.getDriversForSession(sessionKey));
    }

    @GetMapping("/years")
    public ResponseEntity<List<Integer>> getAvailableYears() {
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE)
                .body(referenceDataService.getAvailableYears());
    }

    @GetMapping("/sessions/year/{year}")
    public ResponseEntity<List<RaceSession>> getSessionsByYear(@PathVariable int year) {
        return ResponseEntity.ok().cacheControl(REFERENCE_CACHE)
                .body(referenceDataService.getSessionsByYear(year));
    }
}
