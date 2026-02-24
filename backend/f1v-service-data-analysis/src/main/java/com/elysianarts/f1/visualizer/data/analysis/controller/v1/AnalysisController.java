package com.elysianarts.f1.visualizer.data.analysis.controller.v1;

import com.elysianarts.f1.visualizer.data.analysis.model.LapDataRecord;
import com.elysianarts.f1.visualizer.data.analysis.service.RaceAnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis")
public class AnalysisController {
    private final RaceAnalysisService raceAnalysisService;

    public AnalysisController(RaceAnalysisService raceAnalysisService) {
        this.raceAnalysisService = raceAnalysisService;
    }

    @GetMapping("/session/{sessionKey}/laps")
    public ResponseEntity<List<LapDataRecord>> getSessionLaps(@PathVariable Long sessionKey) {
        // In the future, we can add @RequestParam for specific drivers to filter SQL server-side
        List<LapDataRecord> data = raceAnalysisService.getSessionLapTimes(sessionKey);
        return ResponseEntity.ok(data);
    }
}
