package com.elysianarts.f1.visualizer.telemetry;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// C4, C6: typed configuration, validated at startup.
@ConfigurationPropertiesScan("com.elysianarts.f1.visualizer")
@SpringBootApplication(
        scanBasePackages = {
            "com.elysianarts.f1.visualizer.telemetry",
            "com.elysianarts.f1.visualizer.commons"
        })
public class F1VTelemetryServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VTelemetryServiceApplication.class, args);
    }
}
