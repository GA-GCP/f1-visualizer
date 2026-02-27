package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import com.elysianarts.f1.visualizer.data.analysis.service.ReferenceDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<RaceSession>> getSessions() {
        return ResponseEntity.ok(referenceDataService.getAvailableSessions());
    }

    @GetMapping("/drivers")
    public ResponseEntity<List<DriverProfile>> getDrivers() {
        return ResponseEntity.ok(referenceDataService.getMasterDriverList());
    }
}
