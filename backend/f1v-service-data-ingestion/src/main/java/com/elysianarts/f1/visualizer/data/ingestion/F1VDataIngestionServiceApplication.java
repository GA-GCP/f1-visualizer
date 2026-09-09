package com.elysianarts.f1.visualizer.data.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
// C4, C6: typed configuration, validated at startup.
@ConfigurationPropertiesScan("com.elysianarts.f1.visualizer")
@SpringBootApplication(
        scanBasePackages = {"com.elysianarts.f1.visualizer.data.ingestion", "com.elysianarts.f1.visualizer.commons"})
public class F1VDataIngestionServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VDataIngestionServiceApplication.class, args);
    }
}
