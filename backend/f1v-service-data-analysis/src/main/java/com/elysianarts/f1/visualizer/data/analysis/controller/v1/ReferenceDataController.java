package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceEntryRoster;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.service.ReferenceDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/drivers")
    public ResponseEntity<List<DriverProfile>> getDrivers() {
        return ResponseEntity.ok(referenceDataService.getMasterDriverList());
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<RaceSession>> getSessions() {
        return ResponseEntity.ok(referenceDataService.getAvailableSessions());
    }

    @GetMapping("/sessions/search")
    public ResponseEntity<List<RaceSession>> searchSessions(@RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(referenceDataService.searchSessions(query));
    }

    @GetMapping("/sessions/{sessionKey}/drivers")
    public ResponseEntity<RaceEntryRoster> getSessionDrivers(@PathVariable long sessionKey) {
        return ResponseEntity.ok(referenceDataService.getDriversForSession(sessionKey));
    }

    @GetMapping("/years")
    public ResponseEntity<List<Integer>> getAvailableYears() {
        return ResponseEntity.ok(referenceDataService.getAvailableYears());
    }

    @GetMapping("/sessions/year/{year}")
    public ResponseEntity<List<RaceSession>> getSessionsByYear(@PathVariable int year) {
        return ResponseEntity.ok(referenceDataService.getSessionsByYear(year));
    }
}
