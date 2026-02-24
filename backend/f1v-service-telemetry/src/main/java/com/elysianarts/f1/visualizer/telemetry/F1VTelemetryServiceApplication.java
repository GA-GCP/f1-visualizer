package com.elysianarts.f1.visualizer.telemetry;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.elysianarts.f1.visualizer.telemetry", "com.elysianarts.f1.visualizer.telemetry.config"})
public class F1VTelemetryServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VTelemetryServiceApplication.class, args);
    }
}
