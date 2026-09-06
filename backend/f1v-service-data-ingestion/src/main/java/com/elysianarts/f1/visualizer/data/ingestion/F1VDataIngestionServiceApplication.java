package com.elysianarts.f1.visualizer.data.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync
@EnableScheduling
//@SpringBootApplication
@SpringBootApplication(
        scanBasePackages = {"com.elysianarts.f1.visualizer.data.ingestion", "com.elysianarts.f1.visualizer.commons"},
        excludeName = {
                "org.springframework.cloud.autoconfigure.LifecycleMvcEndpointAutoConfiguration",
                "org.springframework.cloud.autoconfigure.RefreshAutoConfiguration"
        })
public class F1VDataIngestionServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VDataIngestionServiceApplication.class, args);
    }
}
