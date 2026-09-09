package com.elysianarts.f1.visualizer.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// C4, C6: typed configuration, validated at startup.
@ConfigurationPropertiesScan("com.elysianarts.f1.visualizer")
@SpringBootApplication(scanBasePackages = {
        "com.elysianarts.f1.visualizer.user",
        "com.elysianarts.f1.visualizer.commons"
})
public class F1VUserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VUserServiceApplication.class, args);
    }
}
