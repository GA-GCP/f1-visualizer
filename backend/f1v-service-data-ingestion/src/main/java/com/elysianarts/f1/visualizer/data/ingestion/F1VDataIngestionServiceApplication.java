package com.elysianarts.f1.visualizer.data.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
@ComponentScan(basePackages = {"com.elysianarts.f1.visualizer.data.ingestion", "com.elysianarts.f1.visualizer.data.ingestion.config"})
public class F1VDataIngestionServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VDataIngestionServiceApplication.class, args);
    }
}
