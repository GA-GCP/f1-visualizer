package com.elysianarts.f1.visualizer.data.analysis.service;

import com.elysianarts.f1.visualizer.data.analysis.model.DriverProfile;
import com.elysianarts.f1.visualizer.data.analysis.model.RaceSession;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ReferenceDataService {

    public List<RaceSession> searchSessions(String query) {
        if (query == null || query.isBlank()) {
            return getAvailableSessions();
        }

        String lowerQuery = query.toLowerCase();
        return getAvailableSessions().stream()
                .filter(session ->
                        session.getMeetingName().toLowerCase().contains(lowerQuery) ||
                                session.getCountryName().toLowerCase().contains(lowerQuery) ||
                                String.valueOf(session.getYear()).contains(lowerQuery))
                .toList();
    }

    public List<RaceSession> getAvailableSessions() {
        return List.of(
                RaceSession.builder().sessionKey(9165).sessionName("Race").meetingName("Singapore Grand Prix").year(2023).countryName("Singapore").build(),
                RaceSession.builder().sessionKey(9158).sessionName("Race").meetingName("Italian Grand Prix").year(2023).countryName("Italy").build(),
                RaceSession.builder().sessionKey(9161).sessionName("Race").meetingName("Dutch Grand Prix").year(2023).countryName("Netherlands").build(),
                RaceSession.builder().sessionKey(9153).sessionName("Race").meetingName("British Grand Prix").year(2023).countryName("Great Britain").build(),
                RaceSession.builder().sessionKey(9159).sessionName("Race").meetingName("Miami Grand Prix").year(2023).countryName("USA").build()
        );
    }

    public List<DriverProfile> getMasterDriverList() {
        return List.of(
                DriverProfile.builder().id(1).code("VER").name("Max Verstappen").team("Red Bull Racing").teamColor("#3671C6")
                        .stats(DriverProfile.DriverStats.builder().speed(99).consistency(95).aggression(98).tireMgmt(92).experience(85).wins(54).podiums(98).build()).build(),
                DriverProfile.builder().id(16).code("LEC").name("Charles Leclerc").team("Ferrari").teamColor("#E80020")
                        .stats(DriverProfile.DriverStats.builder().speed(96).consistency(88).aggression(90).tireMgmt(85).experience(80).wins(5).podiums(30).build()).build(),
                DriverProfile.builder().id(44).code("HAM").name("Lewis Hamilton").team("Mercedes").teamColor("#27F4D2")
                        .stats(DriverProfile.DriverStats.builder().speed(94).consistency(98).aggression(85).tireMgmt(99).experience(99).wins(103).podiums(197).build()).build(),
                DriverProfile.builder().id(14).code("ALO").name("Fernando Alonso").team("Aston Martin").teamColor("#229971")
                        .stats(DriverProfile.DriverStats.builder().speed(88).consistency(92).aggression(95).tireMgmt(96).experience(100).wins(32).podiums(106).build()).build(),
                DriverProfile.builder().id(4).code("NOR").name("Lando Norris").team("McLaren").teamColor("#FF8000")
                        .stats(DriverProfile.DriverStats.builder().speed(92).consistency(90).aggression(92).tireMgmt(88).experience(75).wins(1).podiums(14).build()).build()
        );
    }
}
