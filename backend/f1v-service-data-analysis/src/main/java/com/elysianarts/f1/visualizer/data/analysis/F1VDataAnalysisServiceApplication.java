package com.elysianarts.f1.visualizer.data.analysis;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.elysianarts.f1.visualizer.data.analysis", "com.elysianarts.f1.visualizer.data.analysis.config"})
public class F1VDataAnalysisServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VDataAnalysisServiceApplication.class, args);
    }
}
